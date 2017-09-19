/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
var vscode = require("vscode");
var child_process_1 = require("child_process");
var path_1 = require("path");
var fs = require("fs");
var utilities_1 = require("./utilities");
var protocolDetection_1 = require("./protocolDetection");
var loadedScripts_1 = require("./loadedScripts");
var processPicker_1 = require("./processPicker");
var loadedScriptsProvider;
function activate(context) {
    // launch config magic
    context.subscriptions.push(vscode.commands.registerCommand('extension.node-debug.provideInitialConfigurations', function (folderUri) { return createInitialConfigurations(folderUri); }));
    context.subscriptions.push(vscode.commands.registerCommand('extension.node-debug.startSession', function (config, folderUri) { return startSession(config, folderUri); }));
    // toggle skipping file action
    context.subscriptions.push(vscode.commands.registerCommand('extension.node-debug.toggleSkippingFile', toggleSkippingFile));
    // process quickpicker
    context.subscriptions.push(vscode.commands.registerCommand('extension.pickNodeProcess', function () { return processPicker_1.pickProcess(); }));
    // loaded scripts
    loadedScriptsProvider = new loadedScripts_1.LoadedScriptsProvider(context);
    vscode.window.registerTreeDataProvider('extension.node-debug.loadedScriptsExplorer', loadedScriptsProvider);
    context.subscriptions.push(vscode.commands.registerCommand('extension.node-debug.pickLoadedScript', function () { return loadedScripts_1.pickLoadedScript(); }));
    context.subscriptions.push(vscode.commands.registerCommand('extension.node-debug.openScript', function (session, path) { return loadedScripts_1.openScript(session, path); }));
}
exports.activate = activate;
function deactivate() {
}
exports.deactivate = deactivate;
//---- toggle skipped files
function toggleSkippingFile(res) {
    var resource = res;
    if (!resource) {
        var activeEditor = vscode.window.activeTextEditor;
        resource = activeEditor && activeEditor.document.fileName;
    }
    if (resource) {
        var args = typeof resource === 'string' ? { resource: resource } : { sourceReference: resource };
        vscode.commands.executeCommand('workbench.customDebugRequest', 'toggleSkipFileStatus', args);
    }
}
//---- extension.node-debug.provideInitialConfigurations
function loadPackage(folder) {
    try {
        var packageJsonPath = path_1.join(folder.uri.fsPath, 'package.json');
        var jsonContent = fs.readFileSync(packageJsonPath, 'utf8');
        return JSON.parse(jsonContent);
    }
    catch (error) {
        // silently ignore
    }
    return undefined;
}
/**
 * returns an initial configuration json as a string
 */
function createInitialConfigurations(folderUri) {
    var folder = getFolder(folderUri);
    var pkg = folder ? loadPackage(folder) : undefined;
    var config = {
        type: 'node',
        request: 'launch',
        name: utilities_1.localize('node.launch.config.name', "Launch Program")
    };
    var initialConfigurations = [config];
    if (pkg && pkg.name === 'mern-starter') {
        utilities_1.log(utilities_1.localize({ key: 'mern.starter.explanation', comment: ['argument contains product name without translation'] }, "Launch configuration for '{0}' project created.", 'Mern Starter'));
        configureMern(config);
    }
    else {
        var program = undefined;
        // try to find a better value for 'program' by analysing package.json
        if (pkg) {
            program = guessProgramFromPackage(folder, pkg);
            if (program) {
                utilities_1.log(utilities_1.localize('program.guessed.from.package.json.explanation', "Launch configuration created based on 'package.json'."));
            }
        }
        if (!program) {
            utilities_1.log(utilities_1.localize('program.fall.back.explanation', "Launch configuration created will debug file in the active editor."));
            program = '${file}';
        }
        config['program'] = program;
        // prepare for source maps by adding 'outFiles' if typescript or coffeescript is detected
        if (vscode.workspace.textDocuments.some(function (document) { return document.languageId === 'typescript' || document.languageId === 'coffeescript'; })) {
            utilities_1.log(utilities_1.localize('outFiles.explanation', "Adjust glob pattern(s) in the 'outFiles' attribute so that they cover the generated JavaScript."));
            config['outFiles'] = ['${workspaceRoot}/out/**/*.js'];
        }
    }
    // Massage the configuration string, add an aditional tab and comment out processId.
    // Add an additional empty line between attributes which the user should not edit.
    var configurationsMassaged = JSON.stringify(initialConfigurations, null, '\t').split('\n').map(function (line) { return '\t' + line; }).join('\n').trim();
    var comment1 = utilities_1.localize('launch.config.comment1', "Use IntelliSense to learn about possible Node.js debug attributes.");
    var comment2 = utilities_1.localize('launch.config.comment2', "Hover to view descriptions of existing attributes.");
    var comment3 = utilities_1.localize('launch.config.comment3', "For more information, visit: {0}", 'https://go.microsoft.com/fwlink/?linkid=830387');
    return [
        '{',
        "\t// " + comment1,
        "\t// " + comment2,
        "\t// " + comment3,
        '\t"version": "0.2.0",',
        '\t"configurations": ' + configurationsMassaged,
        '}'
    ].join('\n');
}
function configureMern(config) {
    config.protocol = 'inspector';
    config.runtimeExecutable = 'nodemon';
    config.program = '${workspaceRoot}/index.js';
    config.restart = true;
    config.env = {
        BABEL_DISABLE_CACHE: '1',
        NODE_ENV: 'development'
    };
    config.console = 'integratedTerminal';
    config.internalConsoleOptions = 'neverOpen';
}
/*
 * try to find the entry point ('main') from the package.json
 */
function guessProgramFromPackage(folder, jsonObject) {
    var program;
    try {
        if (jsonObject.main) {
            program = jsonObject.main;
        }
        else if (jsonObject.scripts && typeof jsonObject.scripts.start === 'string') {
            // assume a start script of the form 'node server.js'
            program = jsonObject.scripts.start.split(' ').pop();
        }
        if (program) {
            var path = void 0;
            if (path_1.isAbsolute(program)) {
                path = program;
            }
            else {
                path = path_1.join(folder.uri.fsPath, program);
                program = path_1.join('${workspaceRoot}', program);
            }
            if (!fs.existsSync(path) && !fs.existsSync(path + '.js')) {
                return undefined;
            }
        }
    }
    catch (error) {
        // silently ignore
    }
    return program;
}
//---- extension.node-debug.startSession & extension.node-debug.eh_startSession
/**
 * The result type of the startSession command.
 */
var StartSessionResult = /** @class */ (function () {
    function StartSessionResult() {
    }
    return StartSessionResult;
}());
function startSession(config, folderUri) {
    var folder = getFolder(folderUri);
    if (Object.keys(config).length === 0) {
        config = getFreshLaunchConfig(folder);
        if (!config.program) {
            var message = utilities_1.localize('program.not.found.message', "Cannot find a program to debug");
            var action_1 = utilities_1.localize('create.launch.json.action', "Create {0}", 'launch.json');
            return vscode.window.showInformationMessage(message, action_1).then(function (a) {
                if (a === action_1) {
                    // let VS Code create an initial configuration
                    return {
                        status: 'initialConfiguration'
                    };
                }
                else {
                    return {
                        status: 'ok'
                    };
                }
            });
        }
    }
    // make sure that configs have a 'cwd' attribute set
    if (!config.cwd) {
        if (folder) {
            config.cwd = folder.uri.fsPath;
        }
        else if (config.program) {
            // derive 'cwd' from 'program'
            config.cwd = path_1.dirname(config.program);
        }
    }
    // determine which protocol to use
    return determineDebugType(config).then(function (debugType) {
        if (debugType) {
            config.type = debugType;
            vscode.commands.executeCommand('vscode.startDebug', config, folder ? folder.uri : undefined);
        }
        return {
            status: 'ok'
        };
    });
}
/**
 * Tried to find a WorkspaceFolder for the given folderUri.
 * If not found, the first WorkspaceFolder is returned.
 * If the workspace has no folders, undefined is returned.
 */
function getFolder(folderUri) {
    var folder;
    var folders = vscode.workspace.workspaceFolders;
    if (folders && folders.length > 0) {
        folder = folders[0];
        if (folderUri) {
            var s_1 = folderUri.toString();
            var found = folders.filter(function (f) { return f.uri.toString() === s_1; });
            if (found.length > 0) {
                folder = found[0];
            }
        }
    }
    return folder;
}
function getFreshLaunchConfig(folder) {
    var config = {
        type: 'node',
        name: 'Launch',
        request: 'launch'
    };
    if (folder) {
        // folder case: try to find more launch info in package.json
        var pkg = loadPackage(folder);
        if (pkg) {
            if (pkg.name === 'mern-starter') {
                configureMern(config);
            }
            else {
                config.program = guessProgramFromPackage(folder, pkg);
            }
        }
    }
    if (!config.program) {
        // 'no folder' case (or no program found)
        var editor = vscode.window.activeTextEditor;
        if (editor && editor.document.languageId === 'javascript') {
            config.program = editor.document.fileName;
        }
    }
    return config;
}
function determineDebugType(config) {
    if (config.request === 'attach' && typeof config.processId === 'string') {
        return determineDebugTypeForPidConfig(config);
    }
    else if (config.protocol === 'legacy') {
        return Promise.resolve('node');
    }
    else if (config.protocol === 'inspector') {
        return Promise.resolve('node2');
    }
    else {
        // 'auto', or unspecified
        return protocolDetection_1.detectDebugType(config);
    }
}
function determineDebugTypeForPidConfig(config) {
    var getPidP = isPickProcessCommand(config.processId) ?
        processPicker_1.pickProcess() :
        Promise.resolve(config.processId);
    return getPidP.then(function (pid) {
        if (pid && pid.match(/^[0-9]+$/)) {
            var pidNum = Number(pid);
            putPidInDebugMode(pidNum);
            return determineDebugTypeForPidInDebugMode(config, pidNum);
        }
        else {
            throw new Error(utilities_1.localize('VSND2006', "Attach to process: '{0}' doesn't look like a process id.", pid));
        }
    }).then(function (debugType) {
        if (debugType) {
            // processID is handled, so turn this config into a normal port attach config
            config.processId = undefined;
            config.port = debugType === 'node2' ? protocolDetection_1.INSPECTOR_PORT_DEFAULT : protocolDetection_1.LEGACY_PORT_DEFAULT;
        }
        return debugType;
    });
}
function isPickProcessCommand(configProcessId) {
    configProcessId = configProcessId.trim();
    return configProcessId === '${command:PickProcess}' || configProcessId === '${command:extension.pickNodeProcess}';
}
function putPidInDebugMode(pid) {
    try {
        if (process.platform === 'win32') {
            // regular node has an undocumented API function for forcing another node process into debug mode.
            // 		(<any>process)._debugProcess(pid);
            // But since we are running on Electron's node, process._debugProcess doesn't work (for unknown reasons).
            // So we use a regular node instead:
            var command = "node -e process._debugProcess(" + pid + ")";
            child_process_1.execSync(command);
        }
        else {
            process.kill(pid, 'SIGUSR1');
        }
    }
    catch (e) {
        throw new Error(utilities_1.localize('VSND2021', "Attach to process: cannot enable debug mode for process '{0}' ({1}).", pid, e));
    }
}
function determineDebugTypeForPidInDebugMode(config, pid) {
    var debugProtocolP;
    if (config.port === protocolDetection_1.INSPECTOR_PORT_DEFAULT) {
        debugProtocolP = Promise.resolve('inspector');
    }
    else if (config.port === protocolDetection_1.LEGACY_PORT_DEFAULT) {
        debugProtocolP = Promise.resolve('legacy');
    }
    else if (config.protocol) {
        debugProtocolP = Promise.resolve(config.protocol);
    }
    else {
        debugProtocolP = protocolDetection_1.detectProtocolForPid(pid);
    }
    return debugProtocolP.then(function (debugProtocol) {
        return debugProtocol === 'inspector' ? 'node2' :
            debugProtocol === 'legacy' ? 'node' :
                null;
    });
}

//# sourceMappingURL=../../../out/node/extension/extension.js.map
