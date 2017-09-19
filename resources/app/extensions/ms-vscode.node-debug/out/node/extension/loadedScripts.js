/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/
'use strict';
var __extends = (this && this.__extends) || (function () {
    var extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
var vscode = require("vscode");
var vscode_1 = require("vscode");
var utilities_1 = require("./utilities");
var path_1 = require("path");
//---- loaded script explorer
var URL_REGEXP = /^(https?:\/\/[^/]+)(\/.*)$/;
var LoadedScriptsProvider = /** @class */ (function () {
    function LoadedScriptsProvider(context) {
        var _this = this;
        this._onDidChangeTreeData = new vscode_1.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
        this._root = new RootTreeItem();
        context.subscriptions.push(vscode.debug.onDidStartDebugSession(function (session) {
            if (session && (session.type === 'node' || session.type === 'node2')) {
                _this._root.add(session);
                _this._onDidChangeTreeData.fire(undefined);
            }
        }));
        var timeout;
        context.subscriptions.push(vscode.debug.onDidReceiveDebugSessionCustomEvent(function (event) {
            if (event.event === 'scriptLoaded' && (event.session.type === 'node' || event.session.type === 'node2' || event.session.type === 'extensionHost' || event.session.type === 'chrome')) {
                var sessionRoot = _this._root.add(event.session);
                sessionRoot.addPath(event.body.path);
                clearTimeout(timeout);
                timeout = setTimeout(function () {
                    _this._onDidChangeTreeData.fire(undefined);
                }, 300);
            }
        }));
        context.subscriptions.push(vscode.debug.onDidTerminateDebugSession(function (session) {
            _this._root.remove(session.id);
            _this._onDidChangeTreeData.fire(undefined);
        }));
    }
    LoadedScriptsProvider.prototype.getChildren = function (node) {
        return (node || this._root).getChildren();
    };
    LoadedScriptsProvider.prototype.getTreeItem = function (node) {
        return node;
    };
    return LoadedScriptsProvider;
}());
exports.LoadedScriptsProvider = LoadedScriptsProvider;
var BaseTreeItem = /** @class */ (function (_super) {
    __extends(BaseTreeItem, _super);
    function BaseTreeItem(label, state) {
        if (state === void 0) { state = vscode.TreeItemCollapsibleState.Collapsed; }
        var _this = _super.call(this, label, state) || this;
        _this._children = {};
        return _this;
    }
    BaseTreeItem.prototype.setPath = function (session, path) {
        this.command = {
            command: 'extension.node-debug.openScript',
            arguments: [session, path],
            title: ''
        };
    };
    BaseTreeItem.prototype.getChildren = function () {
        var _this = this;
        this.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
        var array = Object.keys(this._children).map(function (key) { return _this._children[key]; });
        return array.sort(function (a, b) { return _this.compare(a, b); });
    };
    BaseTreeItem.prototype.createIfNeeded = function (key, factory) {
        var child = this._children[key];
        if (!child) {
            child = factory(key);
            this._children[key] = child;
        }
        return child;
    };
    BaseTreeItem.prototype.remove = function (key) {
        delete this._children[key];
    };
    BaseTreeItem.prototype.compare = function (a, b) {
        return a.label.localeCompare(b.label);
    };
    return BaseTreeItem;
}(vscode_1.TreeItem));
var RootTreeItem = /** @class */ (function (_super) {
    __extends(RootTreeItem, _super);
    function RootTreeItem() {
        var _this = _super.call(this, 'Root', vscode.TreeItemCollapsibleState.Expanded) || this;
        _this._showedMoreThanOne = false;
        return _this;
    }
    RootTreeItem.prototype.getChildren = function () {
        // skip sessions if there is only one
        var children = _super.prototype.getChildren.call(this);
        if (Array.isArray(children)) {
            var size = children.length;
            if (!this._showedMoreThanOne && size === 1) {
                return children[0].getChildren();
            }
            this._showedMoreThanOne = size > 1;
        }
        return children;
    };
    RootTreeItem.prototype.add = function (session) {
        return this.createIfNeeded(session.id, function () { return new SessionTreeItem(session); });
    };
    return RootTreeItem;
}(BaseTreeItem));
var SessionTreeItem = /** @class */ (function (_super) {
    __extends(SessionTreeItem, _super);
    function SessionTreeItem(session) {
        var _this = _super.call(this, session.name, vscode.TreeItemCollapsibleState.Expanded) || this;
        _this._initialized = false;
        _this._session = session;
        return _this;
        /*
        const dir = dirname(__filename);
        this.iconPath = {
            light: join(dir, '..', '..', '..', 'images', 'debug-light.svg'),
            dark: join(dir, '..', '..', '..', 'images', 'debug-dark.svg')
        };
        */
    }
    SessionTreeItem.prototype.getChildren = function () {
        var _this = this;
        if (!this._initialized) {
            this._initialized = true;
            return listLoadedScripts(this._session).then(function (paths) {
                if (paths) {
                    paths.forEach(function (path) { return _this.addPath(path); });
                }
                return _super.prototype.getChildren.call(_this);
            });
        }
        return _super.prototype.getChildren.call(this);
    };
    SessionTreeItem.prototype.compare = function (a, b) {
        var acat = this.category(a);
        var bcat = this.category(b);
        if (acat !== bcat) {
            return acat - bcat;
        }
        return _super.prototype.compare.call(this, a, b);
    };
    /**
     * Return an ordinal number for folders
     */
    SessionTreeItem.prototype.category = function (item) {
        // workspace scripts come at the beginning in "folder" order
        if (item instanceof FolderTreeItem) {
            return item.folder.index;
        }
        // <...> come at the very end
        if (/^<.+>$/.test(item.label)) {
            return 1000;
        }
        // everything else in between
        return 999;
    };
    SessionTreeItem.prototype.addPath = function (path) {
        var folder;
        var url;
        var p;
        var match = URL_REGEXP.exec(path);
        if (match && match.length === 3) {
            url = match[1];
            p = decodeURI(match[2]);
        }
        else {
            folder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(path));
            p = trim(path);
        }
        var x = this;
        p.split(/[\/\\]/).forEach(function (segment, i) {
            if (segment.length === 0) {
                segment = '/';
            }
            if (i === 0 && folder) {
                x = x.createIfNeeded(folder.name, function () { return new FolderTreeItem(folder); });
            }
            else if (i === 0 && url) {
                x = x.createIfNeeded(url, function () { return new BaseTreeItem(url); });
            }
            else {
                x = x.createIfNeeded(segment, function () { return new BaseTreeItem(segment); });
            }
        });
        x.collapsibleState = vscode.TreeItemCollapsibleState.None;
        x.setPath(this._session, path);
    };
    return SessionTreeItem;
}(BaseTreeItem));
var FolderTreeItem = /** @class */ (function (_super) {
    __extends(FolderTreeItem, _super);
    function FolderTreeItem(folder) {
        var _this = _super.call(this, folder.name, vscode.TreeItemCollapsibleState.Collapsed) || this;
        _this.folder = folder;
        return _this;
    }
    return FolderTreeItem;
}(BaseTreeItem));
//---- loaded script picker
function pickLoadedScript() {
    var session = vscode.debug.activeDebugSession;
    return listLoadedScripts(session).then(function (paths) {
        var options = {
            placeHolder: utilities_1.localize('select.script', "Select a script"),
            matchOnDescription: true,
            matchOnDetail: true,
            ignoreFocusOut: true
        };
        var items;
        if (paths === undefined) {
            items = [{ label: utilities_1.localize('no.loaded.scripts', "No loaded scripts available"), description: '' }];
        }
        else {
            items = paths.map(function (path) {
                return {
                    label: path_1.basename(path),
                    description: trim(path)
                };
            }).sort(function (a, b) { return a.label.localeCompare(b.label); });
        }
        vscode.window.showQuickPick(items, options).then(function (item) {
            if (item && item.description) {
                openScript(session, item.description);
            }
        });
    });
}
exports.pickLoadedScript = pickLoadedScript;
var USERHOME;
function getUserHome() {
    if (!USERHOME) {
        USERHOME = require('os').homedir();
        if (USERHOME && USERHOME[USERHOME.length - 1] !== '/') {
            USERHOME += '/';
        }
    }
    return USERHOME;
}
function trim(path) {
    path = vscode.workspace.asRelativePath(path, true);
    if (path.indexOf('/') === 0) {
        path = path.replace(getUserHome(), '~/');
    }
    return path;
}
function listLoadedScripts(session) {
    if (session) {
        return session.customRequest('getLoadedScripts').then(function (reply) {
            return reply.paths;
        }, function (err) {
            return undefined;
        });
    }
    else {
        return Promise.resolve(undefined);
    }
}
function openScript(session, path) {
    var uri = vscode.Uri.parse("debug:" + path + "?session=" + session.id);
    vscode.workspace.openTextDocument(uri).then(function (doc) { return vscode.window.showTextDocument(doc); });
}
exports.openScript = openScript;

//# sourceMappingURL=../../../out/node/extension/loadedScripts.js.map
