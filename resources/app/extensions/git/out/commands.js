/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const vscode_1 = require("vscode");
const git_1 = require("./git");
const repository_1 = require("./repository");
const uri_1 = require("./uri");
const staging_1 = require("./staging");
const path = require("path");
const os = require("os");
const nls = require("vscode-nls");
const localize = nls.loadMessageBundle(__filename);
class CheckoutItem {
    constructor(ref) {
        this.ref = ref;
    }
    get shortCommit() { return (this.ref.commit || '').substr(0, 8); }
    get treeish() { return this.ref.name; }
    get label() { return this.ref.name || this.shortCommit; }
    get description() { return this.shortCommit; }
    run(repository) {
        return __awaiter(this, void 0, void 0, function* () {
            const ref = this.treeish;
            if (!ref) {
                return;
            }
            yield repository.checkout(ref);
        });
    }
}
class CheckoutTagItem extends CheckoutItem {
    get description() {
        return localize(0, null, this.shortCommit);
    }
}
class CheckoutRemoteHeadItem extends CheckoutItem {
    get description() {
        return localize(1, null, this.shortCommit);
    }
    get treeish() {
        if (!this.ref.name) {
            return;
        }
        const match = /^[^/]+\/(.*)$/.exec(this.ref.name);
        return match ? match[1] : this.ref.name;
    }
}
class BranchDeleteItem {
    constructor(ref) {
        this.ref = ref;
    }
    get shortCommit() { return (this.ref.commit || '').substr(0, 8); }
    get branchName() { return this.ref.name; }
    get label() { return this.branchName || ''; }
    get description() { return this.shortCommit; }
    run(repository, force) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.branchName) {
                return;
            }
            yield repository.deleteBranch(this.branchName, force);
        });
    }
}
class MergeItem {
    constructor(ref) {
        this.ref = ref;
    }
    get label() { return this.ref.name || ''; }
    get description() { return this.ref.name || ''; }
    run(repository) {
        return __awaiter(this, void 0, void 0, function* () {
            yield repository.merge(this.ref.name || this.ref.commit);
        });
    }
}
class CreateBranchItem {
    get label() { return localize(2, null); }
    get description() { return ''; }
    run(repository) {
        return __awaiter(this, void 0, void 0, function* () {
            yield vscode_1.commands.executeCommand('git.branch');
        });
    }
}
const Commands = [];
function command(commandId, options = {}) {
    return (target, key, descriptor) => {
        if (!(typeof descriptor.value === 'function')) {
            throw new Error('not supported');
        }
        Commands.push({ commandId, key, method: descriptor.value, options });
    };
}
class CommandCenter {
    constructor(git, model, outputChannel, telemetryReporter) {
        this.git = git;
        this.model = model;
        this.outputChannel = outputChannel;
        this.telemetryReporter = telemetryReporter;
        this.disposables = Commands.map(({ commandId, key, method, options }) => {
            const command = this.createCommand(commandId, key, method, options);
            if (options.diff) {
                return vscode_1.commands.registerDiffInformationCommand(commandId, command);
            }
            else {
                return vscode_1.commands.registerCommand(commandId, command);
            }
        });
    }
    refresh(repository) {
        return __awaiter(this, void 0, void 0, function* () {
            yield repository.status();
        });
    }
    openResource(resource) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this._openResource(resource, undefined, true, false);
        });
    }
    _openResource(resource, preview, preserveFocus, preserveSelection) {
        return __awaiter(this, void 0, void 0, function* () {
            const left = this.getLeftResource(resource);
            const right = this.getRightResource(resource);
            const title = this.getTitle(resource);
            if (!right) {
                // TODO
                console.error('oh no');
                return;
            }
            const opts = {
                preserveFocus,
                preview,
                viewColumn: vscode_1.window.activeTextEditor && vscode_1.window.activeTextEditor.viewColumn || vscode_1.ViewColumn.One
            };
            const activeTextEditor = vscode_1.window.activeTextEditor;
            if (preserveSelection && activeTextEditor && activeTextEditor.document.uri.fsPath === right.fsPath) {
                opts.selection = activeTextEditor.selection;
            }
            if (!left) {
                const document = yield vscode_1.workspace.openTextDocument(right);
                yield vscode_1.window.showTextDocument(document, opts);
                return;
            }
            return yield vscode_1.commands.executeCommand('vscode.diff', left, right, title, opts);
        });
    }
    getLeftResource(resource) {
        switch (resource.type) {
            case repository_1.Status.INDEX_MODIFIED:
            case repository_1.Status.INDEX_RENAMED:
                return uri_1.toGitUri(resource.original, 'HEAD');
            case repository_1.Status.MODIFIED:
                return uri_1.toGitUri(resource.resourceUri, '~');
            case repository_1.Status.DELETED_BY_THEM:
                return uri_1.toGitUri(resource.resourceUri, '');
        }
    }
    getRightResource(resource) {
        switch (resource.type) {
            case repository_1.Status.INDEX_MODIFIED:
            case repository_1.Status.INDEX_ADDED:
            case repository_1.Status.INDEX_COPIED:
            case repository_1.Status.INDEX_RENAMED:
                return uri_1.toGitUri(resource.resourceUri, '');
            case repository_1.Status.INDEX_DELETED:
            case repository_1.Status.DELETED_BY_THEM:
            case repository_1.Status.DELETED:
                return uri_1.toGitUri(resource.resourceUri, 'HEAD');
            case repository_1.Status.MODIFIED:
            case repository_1.Status.UNTRACKED:
            case repository_1.Status.IGNORED:
                const repository = this.model.getRepository(resource.resourceUri);
                if (!repository) {
                    return;
                }
                const uriString = resource.resourceUri.toString();
                const [indexStatus] = repository.indexGroup.resourceStates.filter(r => r.resourceUri.toString() === uriString);
                if (indexStatus && indexStatus.renameResourceUri) {
                    return indexStatus.renameResourceUri;
                }
                return resource.resourceUri;
            case repository_1.Status.BOTH_ADDED:
            case repository_1.Status.BOTH_MODIFIED:
                return resource.resourceUri;
        }
    }
    getTitle(resource) {
        const basename = path.basename(resource.resourceUri.fsPath);
        switch (resource.type) {
            case repository_1.Status.INDEX_MODIFIED:
            case repository_1.Status.INDEX_RENAMED:
            case repository_1.Status.DELETED_BY_THEM:
                return `${basename} (Index)`;
            case repository_1.Status.MODIFIED:
            case repository_1.Status.BOTH_ADDED:
            case repository_1.Status.BOTH_MODIFIED:
                return `${basename} (Working Tree)`;
        }
        return '';
    }
    clone() {
        return __awaiter(this, void 0, void 0, function* () {
            const url = yield vscode_1.window.showInputBox({
                prompt: localize(3, null),
                ignoreFocusOut: true
            });
            if (!url) {
                this.telemetryReporter.sendTelemetryEvent('clone', { outcome: 'no_URL' });
                return;
            }
            const config = vscode_1.workspace.getConfiguration('git');
            const value = config.get('defaultCloneDirectory') || os.homedir();
            const parentPath = yield vscode_1.window.showInputBox({
                prompt: localize(4, null),
                value,
                ignoreFocusOut: true
            });
            if (!parentPath) {
                this.telemetryReporter.sendTelemetryEvent('clone', { outcome: 'no_directory' });
                return;
            }
            const clonePromise = this.git.clone(url, parentPath);
            try {
                vscode_1.window.withProgress({ location: vscode_1.ProgressLocation.SourceControl, title: localize(5, null) }, () => clonePromise);
                vscode_1.window.withProgress({ location: vscode_1.ProgressLocation.Window, title: localize(6, null) }, () => clonePromise);
                const repositoryPath = yield clonePromise;
                const open = localize(7, null);
                const result = yield vscode_1.window.showInformationMessage(localize(8, null), open);
                const openFolder = result === open;
                this.telemetryReporter.sendTelemetryEvent('clone', { outcome: 'success' }, { openFolder: openFolder ? 1 : 0 });
                if (openFolder) {
                    vscode_1.commands.executeCommand('vscode.openFolder', vscode_1.Uri.file(repositoryPath));
                }
            }
            catch (err) {
                if (/already exists and is not an empty directory/.test(err && err.stderr || '')) {
                    this.telemetryReporter.sendTelemetryEvent('clone', { outcome: 'directory_not_empty' });
                }
                else {
                    this.telemetryReporter.sendTelemetryEvent('clone', { outcome: 'error' });
                }
                throw err;
            }
        });
    }
    init() {
        return __awaiter(this, void 0, void 0, function* () {
            const value = vscode_1.workspace.workspaceFolders && vscode_1.workspace.workspaceFolders.length > 0
                ? vscode_1.workspace.workspaceFolders[0].uri.fsPath
                : os.homedir();
            const path = yield vscode_1.window.showInputBox({
                placeHolder: localize(9, null),
                prompt: localize(10, null),
                value,
                ignoreFocusOut: true
            });
            if (!path) {
                return;
            }
            yield this.git.init(path);
            yield this.model.tryOpenRepository(path);
        });
    }
    openFile(arg, ...resourceStates) {
        return __awaiter(this, void 0, void 0, function* () {
            const preserveFocus = arg instanceof repository_1.Resource;
            let uris;
            if (arg instanceof vscode_1.Uri) {
                if (arg.scheme === 'git') {
                    uris = [vscode_1.Uri.file(uri_1.fromGitUri(arg).path)];
                }
                else if (arg.scheme === 'file') {
                    uris = [arg];
                }
            }
            else {
                let resource = arg;
                if (!(resource instanceof repository_1.Resource)) {
                    // can happen when called from a keybinding
                    resource = this.getSCMResource();
                }
                if (resource) {
                    uris = [...resourceStates.map(r => r.resourceUri), resource.resourceUri];
                }
            }
            if (!uris) {
                return;
            }
            const preview = uris.length === 1 ? true : false;
            const activeTextEditor = vscode_1.window.activeTextEditor;
            for (const uri of uris) {
                const opts = {
                    preserveFocus,
                    preview: preview,
                    viewColumn: activeTextEditor && activeTextEditor.viewColumn || vscode_1.ViewColumn.One
                };
                if (activeTextEditor && activeTextEditor.document.uri.fsPath === uri.fsPath) {
                    opts.selection = activeTextEditor.selection;
                }
                const document = yield vscode_1.workspace.openTextDocument(uri);
                yield vscode_1.window.showTextDocument(document, opts);
            }
        });
    }
    openHEADFile(arg) {
        return __awaiter(this, void 0, void 0, function* () {
            let resource = undefined;
            if (arg instanceof repository_1.Resource) {
                resource = arg;
            }
            else if (arg instanceof vscode_1.Uri) {
                resource = this.getSCMResource(arg);
            }
            else {
                resource = this.getSCMResource();
            }
            if (!resource) {
                return;
            }
            const HEAD = this.getLeftResource(resource);
            if (!HEAD) {
                vscode_1.window.showWarningMessage(localize(11, null, path.basename(resource.resourceUri.fsPath)));
                return;
            }
            return yield vscode_1.commands.executeCommand('vscode.open', HEAD);
        });
    }
    openChange(arg, ...resourceStates) {
        return __awaiter(this, void 0, void 0, function* () {
            const preserveFocus = arg instanceof repository_1.Resource;
            const preserveSelection = arg instanceof vscode_1.Uri || !arg;
            let resources = undefined;
            if (arg instanceof vscode_1.Uri) {
                const resource = this.getSCMResource(arg);
                if (resource !== undefined) {
                    resources = [resource];
                }
            }
            else {
                let resource = undefined;
                if (arg instanceof repository_1.Resource) {
                    resource = arg;
                }
                else {
                    resource = this.getSCMResource();
                }
                if (resource) {
                    resources = [...resourceStates, resource];
                }
            }
            if (!resources) {
                return;
            }
            const preview = resources.length === 1 ? undefined : false;
            for (const resource of resources) {
                yield this._openResource(resource, preview, preserveFocus, preserveSelection);
            }
        });
    }
    stage(...resourceStates) {
        return __awaiter(this, void 0, void 0, function* () {
            if (resourceStates.length === 0 || !(resourceStates[0].resourceUri instanceof vscode_1.Uri)) {
                const resource = this.getSCMResource();
                if (!resource) {
                    return;
                }
                resourceStates = [resource];
            }
            const selection = resourceStates.filter(s => s instanceof repository_1.Resource);
            const mergeConflicts = selection.filter(s => s.resourceGroupType === repository_1.ResourceGroupType.Merge);
            if (mergeConflicts.length > 0) {
                const message = mergeConflicts.length > 1
                    ? localize(12, null, mergeConflicts.length)
                    : localize(13, null, path.basename(mergeConflicts[0].resourceUri.fsPath));
                const yes = localize(14, null);
                const pick = yield vscode_1.window.showWarningMessage(message, { modal: true }, yes);
                if (pick !== yes) {
                    return;
                }
            }
            const workingTree = selection
                .filter(s => s.resourceGroupType === repository_1.ResourceGroupType.WorkingTree);
            const scmResources = [...workingTree, ...mergeConflicts];
            if (!scmResources.length) {
                return;
            }
            const resources = scmResources.map(r => r.resourceUri);
            yield this.runByRepository(resources, (repository, resources) => __awaiter(this, void 0, void 0, function* () { return repository.add(resources); }));
        });
    }
    stageAll(repository) {
        return __awaiter(this, void 0, void 0, function* () {
            const resources = repository.mergeGroup.resourceStates.filter(s => s instanceof repository_1.Resource);
            const mergeConflicts = resources.filter(s => s.resourceGroupType === repository_1.ResourceGroupType.Merge);
            if (mergeConflicts.length > 0) {
                const message = mergeConflicts.length > 1
                    ? localize(15, null, mergeConflicts.length)
                    : localize(16, null, path.basename(mergeConflicts[0].resourceUri.fsPath));
                const yes = localize(17, null);
                const pick = yield vscode_1.window.showWarningMessage(message, { modal: true }, yes);
                if (pick !== yes) {
                    return;
                }
            }
            yield repository.add([]);
        });
    }
    stageSelectedRanges(diffs) {
        return __awaiter(this, void 0, void 0, function* () {
            const textEditor = vscode_1.window.activeTextEditor;
            if (!textEditor) {
                return;
            }
            const modifiedDocument = textEditor.document;
            const modifiedUri = modifiedDocument.uri;
            if (modifiedUri.scheme !== 'file') {
                return;
            }
            const originalUri = uri_1.toGitUri(modifiedUri, '~');
            const originalDocument = yield vscode_1.workspace.openTextDocument(originalUri);
            const selectedLines = staging_1.toLineRanges(textEditor.selections, modifiedDocument);
            const selectedDiffs = diffs
                .map(diff => selectedLines.reduce((result, range) => result || staging_1.intersectDiffWithRange(modifiedDocument, diff, range), null))
                .filter(d => !!d);
            if (!selectedDiffs.length) {
                return;
            }
            const result = staging_1.applyLineChanges(originalDocument, modifiedDocument, selectedDiffs);
            yield this.runByRepository(modifiedUri, (repository, resource) => __awaiter(this, void 0, void 0, function* () { return yield repository.stage(resource, result); }));
        });
    }
    revertSelectedRanges(diffs) {
        return __awaiter(this, void 0, void 0, function* () {
            const textEditor = vscode_1.window.activeTextEditor;
            if (!textEditor) {
                return;
            }
            const modifiedDocument = textEditor.document;
            const modifiedUri = modifiedDocument.uri;
            if (modifiedUri.scheme !== 'file') {
                return;
            }
            const originalUri = uri_1.toGitUri(modifiedUri, '~');
            const originalDocument = yield vscode_1.workspace.openTextDocument(originalUri);
            const selections = textEditor.selections;
            const selectedDiffs = diffs.filter(diff => {
                const modifiedRange = diff.modifiedEndLineNumber === 0
                    ? new vscode_1.Range(modifiedDocument.lineAt(diff.modifiedStartLineNumber - 1).range.end, modifiedDocument.lineAt(diff.modifiedStartLineNumber).range.start)
                    : new vscode_1.Range(modifiedDocument.lineAt(diff.modifiedStartLineNumber - 1).range.start, modifiedDocument.lineAt(diff.modifiedEndLineNumber - 1).range.end);
                return selections.every(selection => !selection.intersection(modifiedRange));
            });
            if (selectedDiffs.length === diffs.length) {
                return;
            }
            const basename = path.basename(modifiedUri.fsPath);
            const message = localize(18, null, basename);
            const yes = localize(19, null);
            const pick = yield vscode_1.window.showWarningMessage(message, { modal: true }, yes);
            if (pick !== yes) {
                return;
            }
            const result = staging_1.applyLineChanges(originalDocument, modifiedDocument, selectedDiffs);
            const edit = new vscode_1.WorkspaceEdit();
            edit.replace(modifiedUri, new vscode_1.Range(new vscode_1.Position(0, 0), modifiedDocument.lineAt(modifiedDocument.lineCount - 1).range.end), result);
            vscode_1.workspace.applyEdit(edit);
        });
    }
    unstage(...resourceStates) {
        return __awaiter(this, void 0, void 0, function* () {
            if (resourceStates.length === 0 || !(resourceStates[0].resourceUri instanceof vscode_1.Uri)) {
                const resource = this.getSCMResource();
                if (!resource) {
                    return;
                }
                resourceStates = [resource];
            }
            const scmResources = resourceStates
                .filter(s => s instanceof repository_1.Resource && s.resourceGroupType === repository_1.ResourceGroupType.Index);
            if (!scmResources.length) {
                return;
            }
            const resources = scmResources.map(r => r.resourceUri);
            yield this.runByRepository(resources, (repository, resources) => __awaiter(this, void 0, void 0, function* () { return repository.revert(resources); }));
        });
    }
    unstageAll(repository) {
        return __awaiter(this, void 0, void 0, function* () {
            yield repository.revert([]);
        });
    }
    unstageSelectedRanges(diffs) {
        return __awaiter(this, void 0, void 0, function* () {
            const textEditor = vscode_1.window.activeTextEditor;
            if (!textEditor) {
                return;
            }
            const modifiedDocument = textEditor.document;
            const modifiedUri = modifiedDocument.uri;
            if (modifiedUri.scheme !== 'git') {
                return;
            }
            const { ref } = uri_1.fromGitUri(modifiedUri);
            if (ref !== '') {
                return;
            }
            const originalUri = uri_1.toGitUri(modifiedUri, 'HEAD');
            const originalDocument = yield vscode_1.workspace.openTextDocument(originalUri);
            const selectedLines = staging_1.toLineRanges(textEditor.selections, modifiedDocument);
            const selectedDiffs = diffs
                .map(diff => selectedLines.reduce((result, range) => result || staging_1.intersectDiffWithRange(modifiedDocument, diff, range), null))
                .filter(d => !!d);
            if (!selectedDiffs.length) {
                return;
            }
            const invertedDiffs = selectedDiffs.map(staging_1.invertLineChange);
            const result = staging_1.applyLineChanges(modifiedDocument, originalDocument, invertedDiffs);
            yield this.runByRepository(modifiedUri, (repository, resource) => __awaiter(this, void 0, void 0, function* () { return yield repository.stage(resource, result); }));
        });
    }
    clean(...resourceStates) {
        return __awaiter(this, void 0, void 0, function* () {
            if (resourceStates.length === 0 || !(resourceStates[0].resourceUri instanceof vscode_1.Uri)) {
                const resource = this.getSCMResource();
                if (!resource) {
                    return;
                }
                resourceStates = [resource];
            }
            const scmResources = resourceStates
                .filter(s => s instanceof repository_1.Resource && s.resourceGroupType === repository_1.ResourceGroupType.WorkingTree);
            if (!scmResources.length) {
                return;
            }
            const untrackedCount = scmResources.reduce((s, r) => s + (r.type === repository_1.Status.UNTRACKED ? 1 : 0), 0);
            let message;
            let yes = localize(20, null);
            if (scmResources.length === 1) {
                if (untrackedCount > 0) {
                    message = localize(21, null, path.basename(scmResources[0].resourceUri.fsPath));
                    yes = localize(22, null);
                }
                else {
                    message = localize(23, null, path.basename(scmResources[0].resourceUri.fsPath));
                }
            }
            else {
                message = localize(24, null, scmResources.length);
                if (untrackedCount > 0) {
                    message = `${message}\n\n${localize(25, null, untrackedCount)}`;
                }
            }
            const pick = yield vscode_1.window.showWarningMessage(message, { modal: true }, yes);
            if (pick !== yes) {
                return;
            }
            const resources = scmResources.map(r => r.resourceUri);
            yield this.runByRepository(resources, (repository, resources) => __awaiter(this, void 0, void 0, function* () { return repository.clean(resources); }));
        });
    }
    cleanAll(repository) {
        return __awaiter(this, void 0, void 0, function* () {
            let resources = repository.workingTreeGroup.resourceStates;
            if (resources.length === 0) {
                return;
            }
            const trackedResources = resources.filter(r => r.type !== repository_1.Status.UNTRACKED && r.type !== repository_1.Status.IGNORED);
            const untrackedResources = resources.filter(r => r.type === repository_1.Status.UNTRACKED || r.type === repository_1.Status.IGNORED);
            if (untrackedResources.length === 0) {
                const message = resources.length === 1
                    ? localize(26, null, path.basename(resources[0].resourceUri.fsPath))
                    : localize(27, null, resources.length);
                const yes = resources.length === 1
                    ? localize(28, null)
                    : localize(29, null, resources.length);
                const pick = yield vscode_1.window.showWarningMessage(message, { modal: true }, yes);
                if (pick !== yes) {
                    return;
                }
                yield repository.clean(resources.map(r => r.resourceUri));
                return;
            }
            else if (resources.length === 1) {
                const message = localize(30, null, path.basename(resources[0].resourceUri.fsPath));
                const yes = localize(31, null);
                const pick = yield vscode_1.window.showWarningMessage(message, { modal: true }, yes);
                if (pick !== yes) {
                    return;
                }
                yield repository.clean(resources.map(r => r.resourceUri));
            }
            else if (trackedResources.length === 0) {
                const message = localize(32, null, resources.length);
                const yes = localize(33, null);
                const pick = yield vscode_1.window.showWarningMessage(message, { modal: true }, yes);
                if (pick !== yes) {
                    return;
                }
                yield repository.clean(resources.map(r => r.resourceUri));
            }
            else {
                const untrackedMessage = untrackedResources.length === 1
                    ? localize(34, null, path.basename(untrackedResources[0].resourceUri.fsPath))
                    : localize(35, null, untrackedResources.length);
                const message = localize(36, null, untrackedMessage, resources.length);
                const yesTracked = trackedResources.length === 1
                    ? localize(37, null, trackedResources.length)
                    : localize(38, null, trackedResources.length);
                const yesAll = localize(39, null, resources.length);
                const pick = yield vscode_1.window.showWarningMessage(message, { modal: true }, yesTracked, yesAll);
                if (pick === yesTracked) {
                    resources = trackedResources;
                }
                else if (pick !== yesAll) {
                    return;
                }
                yield repository.clean(resources.map(r => r.resourceUri));
            }
        });
    }
    smartCommit(repository, getCommitMessage, opts) {
        return __awaiter(this, void 0, void 0, function* () {
            const config = vscode_1.workspace.getConfiguration('git');
            const enableSmartCommit = config.get('enableSmartCommit') === true;
            const enableCommitSigning = config.get('enableCommitSigning') === true;
            const noStagedChanges = repository.indexGroup.resourceStates.length === 0;
            const noUnstagedChanges = repository.workingTreeGroup.resourceStates.length === 0;
            // no changes, and the user has not configured to commit all in this case
            if (!noUnstagedChanges && noStagedChanges && !enableSmartCommit) {
                // prompt the user if we want to commit all or not
                const message = localize(40, null);
                const yes = localize(41, null);
                const always = localize(42, null);
                const pick = yield vscode_1.window.showWarningMessage(message, { modal: true }, yes, always);
                if (pick === always) {
                    config.update('enableSmartCommit', true, true);
                }
                else if (pick !== yes) {
                    return false; // do not commit on cancel
                }
            }
            if (!opts) {
                opts = { all: noStagedChanges };
            }
            // enable signing of commits if configurated
            opts.signCommit = enableCommitSigning;
            if (
            // no changes
            (noStagedChanges && noUnstagedChanges)
                || (!opts.all && noStagedChanges)) {
                vscode_1.window.showInformationMessage(localize(43, null));
                return false;
            }
            const message = yield getCommitMessage();
            if (!message) {
                return false;
            }
            yield repository.commit(message, opts);
            return true;
        });
    }
    commitWithAnyInput(repository, opts) {
        return __awaiter(this, void 0, void 0, function* () {
            const message = repository.inputBox.value;
            const getCommitMessage = () => __awaiter(this, void 0, void 0, function* () {
                if (message) {
                    return message;
                }
                return yield vscode_1.window.showInputBox({
                    placeHolder: localize(44, null),
                    prompt: localize(45, null),
                    ignoreFocusOut: true
                });
            });
            const didCommit = yield this.smartCommit(repository, getCommitMessage, opts);
            if (message && didCommit) {
                repository.inputBox.value = yield repository.getCommitTemplate();
            }
        });
    }
    commit(repository) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.commitWithAnyInput(repository);
        });
    }
    commitWithInput(repository) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!repository.inputBox.value) {
                return;
            }
            const didCommit = yield this.smartCommit(repository, () => __awaiter(this, void 0, void 0, function* () { return repository.inputBox.value; }));
            if (didCommit) {
                repository.inputBox.value = yield repository.getCommitTemplate();
            }
        });
    }
    commitStaged(repository) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.commitWithAnyInput(repository, { all: false });
        });
    }
    commitStagedSigned(repository) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.commitWithAnyInput(repository, { all: false, signoff: true });
        });
    }
    commitStagedAmend(repository) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.commitWithAnyInput(repository, { all: false, amend: true });
        });
    }
    commitAll(repository) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.commitWithAnyInput(repository, { all: true });
        });
    }
    commitAllSigned(repository) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.commitWithAnyInput(repository, { all: true, signoff: true });
        });
    }
    commitAllAmend(repository) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.commitWithAnyInput(repository, { all: true, amend: true });
        });
    }
    undoCommit(repository) {
        return __awaiter(this, void 0, void 0, function* () {
            const HEAD = repository.HEAD;
            if (!HEAD || !HEAD.commit) {
                return;
            }
            const commit = yield repository.getCommit('HEAD');
            yield repository.reset('HEAD~');
            repository.inputBox.value = commit.message;
        });
    }
    checkout(repository, treeish) {
        return __awaiter(this, void 0, void 0, function* () {
            if (typeof treeish === 'string') {
                return yield repository.checkout(treeish);
            }
            const config = vscode_1.workspace.getConfiguration('git');
            const checkoutType = config.get('checkoutType') || 'all';
            const includeTags = checkoutType === 'all' || checkoutType === 'tags';
            const includeRemotes = checkoutType === 'all' || checkoutType === 'remote';
            const createBranch = new CreateBranchItem();
            const heads = repository.refs.filter(ref => ref.type === git_1.RefType.Head)
                .map(ref => new CheckoutItem(ref));
            const tags = (includeTags ? repository.refs.filter(ref => ref.type === git_1.RefType.Tag) : [])
                .map(ref => new CheckoutTagItem(ref));
            const remoteHeads = (includeRemotes ? repository.refs.filter(ref => ref.type === git_1.RefType.RemoteHead) : [])
                .map(ref => new CheckoutRemoteHeadItem(ref));
            const picks = [createBranch, ...heads, ...tags, ...remoteHeads];
            const placeHolder = localize(46, null);
            const choice = yield vscode_1.window.showQuickPick(picks, { placeHolder });
            if (!choice) {
                return;
            }
            yield choice.run(repository);
        });
    }
    branch(repository) {
        return __awaiter(this, void 0, void 0, function* () {
            const result = yield vscode_1.window.showInputBox({
                placeHolder: localize(47, null),
                prompt: localize(48, null),
                ignoreFocusOut: true
            });
            if (!result) {
                return;
            }
            const name = result.replace(/^\.|\/\.|\.\.|~|\^|:|\/$|\.lock$|\.lock\/|\\|\*|\s|^\s*$|\.$/g, '-');
            yield repository.branch(name);
        });
    }
    deleteBranch(repository, name, force) {
        return __awaiter(this, void 0, void 0, function* () {
            let run;
            if (typeof name === 'string') {
                run = force => repository.deleteBranch(name, force);
            }
            else {
                const currentHead = repository.HEAD && repository.HEAD.name;
                const heads = repository.refs.filter(ref => ref.type === git_1.RefType.Head && ref.name !== currentHead)
                    .map(ref => new BranchDeleteItem(ref));
                const placeHolder = localize(49, null);
                const choice = yield vscode_1.window.showQuickPick(heads, { placeHolder });
                if (!choice || !choice.branchName) {
                    return;
                }
                name = choice.branchName;
                run = force => choice.run(repository, force);
            }
            try {
                yield run(force);
            }
            catch (err) {
                if (err.gitErrorCode !== git_1.GitErrorCodes.BranchNotFullyMerged) {
                    throw err;
                }
                const message = localize(50, null, name);
                const yes = localize(51, null);
                const pick = yield vscode_1.window.showWarningMessage(message, yes);
                if (pick === yes) {
                    yield run(true);
                }
            }
        });
    }
    merge(repository) {
        return __awaiter(this, void 0, void 0, function* () {
            const config = vscode_1.workspace.getConfiguration('git');
            const checkoutType = config.get('checkoutType') || 'all';
            const includeRemotes = checkoutType === 'all' || checkoutType === 'remote';
            const heads = repository.refs.filter(ref => ref.type === git_1.RefType.Head)
                .filter(ref => ref.name || ref.commit)
                .map(ref => new MergeItem(ref));
            const remoteHeads = (includeRemotes ? repository.refs.filter(ref => ref.type === git_1.RefType.RemoteHead) : [])
                .filter(ref => ref.name || ref.commit)
                .map(ref => new MergeItem(ref));
            const picks = [...heads, ...remoteHeads];
            const placeHolder = localize(52, null);
            const choice = yield vscode_1.window.showQuickPick(picks, { placeHolder });
            if (!choice) {
                return;
            }
            try {
                yield choice.run(repository);
            }
            catch (err) {
                if (err.gitErrorCode !== git_1.GitErrorCodes.Conflict) {
                    throw err;
                }
                const message = localize(53, null);
                yield vscode_1.window.showWarningMessage(message);
            }
        });
    }
    createTag(repository) {
        return __awaiter(this, void 0, void 0, function* () {
            const inputTagName = yield vscode_1.window.showInputBox({
                placeHolder: localize(54, null),
                prompt: localize(55, null),
                ignoreFocusOut: true
            });
            if (!inputTagName) {
                return;
            }
            const inputMessage = yield vscode_1.window.showInputBox({
                placeHolder: localize(56, null),
                prompt: localize(57, null),
                ignoreFocusOut: true
            });
            const name = inputTagName.replace(/^\.|\/\.|\.\.|~|\^|:|\/$|\.lock$|\.lock\/|\\|\*|\s|^\s*$|\.$/g, '-');
            const message = inputMessage || name;
            yield repository.tag(name, message);
        });
    }
    pullFrom(repository) {
        return __awaiter(this, void 0, void 0, function* () {
            const remotes = repository.remotes;
            if (remotes.length === 0) {
                vscode_1.window.showWarningMessage(localize(58, null));
                return;
            }
            const picks = remotes.map(r => ({ label: r.name, description: r.url }));
            const placeHolder = localize(59, null);
            const pick = yield vscode_1.window.showQuickPick(picks, { placeHolder });
            if (!pick) {
                return;
            }
            const branchName = yield vscode_1.window.showInputBox({
                placeHolder: localize(60, null),
                prompt: localize(61, null),
                ignoreFocusOut: true
            });
            if (!branchName) {
                return;
            }
            repository.pull(false, pick.label, branchName);
        });
    }
    pull(repository) {
        return __awaiter(this, void 0, void 0, function* () {
            const remotes = repository.remotes;
            if (remotes.length === 0) {
                vscode_1.window.showWarningMessage(localize(62, null));
                return;
            }
            yield repository.pull();
        });
    }
    pullRebase(repository) {
        return __awaiter(this, void 0, void 0, function* () {
            const remotes = repository.remotes;
            if (remotes.length === 0) {
                vscode_1.window.showWarningMessage(localize(63, null));
                return;
            }
            yield repository.pullWithRebase();
        });
    }
    push(repository) {
        return __awaiter(this, void 0, void 0, function* () {
            const remotes = repository.remotes;
            if (remotes.length === 0) {
                vscode_1.window.showWarningMessage(localize(64, null));
                return;
            }
            yield repository.push();
        });
    }
    pushWithTags(repository) {
        return __awaiter(this, void 0, void 0, function* () {
            const remotes = repository.remotes;
            if (remotes.length === 0) {
                vscode_1.window.showWarningMessage(localize(65, null));
                return;
            }
            yield repository.pushTags();
            vscode_1.window.showInformationMessage(localize(66, null));
        });
    }
    pushTo(repository) {
        return __awaiter(this, void 0, void 0, function* () {
            const remotes = repository.remotes;
            if (remotes.length === 0) {
                vscode_1.window.showWarningMessage(localize(67, null));
                return;
            }
            if (!repository.HEAD || !repository.HEAD.name) {
                vscode_1.window.showWarningMessage(localize(68, null));
                return;
            }
            const branchName = repository.HEAD.name;
            const picks = remotes.map(r => ({ label: r.name, description: r.url }));
            const placeHolder = localize(69, null, branchName);
            const pick = yield vscode_1.window.showQuickPick(picks, { placeHolder });
            if (!pick) {
                return;
            }
            repository.pushTo(pick.label, branchName);
        });
    }
    sync(repository) {
        return __awaiter(this, void 0, void 0, function* () {
            const HEAD = repository.HEAD;
            if (!HEAD || !HEAD.upstream) {
                return;
            }
            const config = vscode_1.workspace.getConfiguration('git');
            const shouldPrompt = config.get('confirmSync') === true;
            if (shouldPrompt) {
                const message = localize(70, null, HEAD.upstream);
                const yes = localize(71, null);
                const neverAgain = localize(72, null);
                const pick = yield vscode_1.window.showWarningMessage(message, { modal: true }, yes, neverAgain);
                if (pick === neverAgain) {
                    yield config.update('confirmSync', false, true);
                }
                else if (pick !== yes) {
                    return;
                }
            }
            yield repository.sync();
        });
    }
    publish(repository) {
        return __awaiter(this, void 0, void 0, function* () {
            const remotes = repository.remotes;
            if (remotes.length === 0) {
                vscode_1.window.showWarningMessage(localize(73, null));
                return;
            }
            const branchName = repository.HEAD && repository.HEAD.name || '';
            const picks = repository.remotes.map(r => r.name);
            const placeHolder = localize(74, null, branchName);
            const choice = yield vscode_1.window.showQuickPick(picks, { placeHolder });
            if (!choice) {
                return;
            }
            yield repository.pushTo(choice, branchName, true);
        });
    }
    showOutput() {
        this.outputChannel.show();
    }
    ignore(repository, ...resourceStates) {
        return __awaiter(this, void 0, void 0, function* () {
            if (resourceStates.length === 0 || !(resourceStates[0].resourceUri instanceof vscode_1.Uri)) {
                const uri = vscode_1.window.activeTextEditor && vscode_1.window.activeTextEditor.document.uri;
                if (!uri) {
                    return;
                }
                return yield repository.ignore([uri]);
            }
            const uris = resourceStates
                .filter(s => s instanceof repository_1.Resource)
                .map(r => r.resourceUri);
            if (!uris.length) {
                return;
            }
            yield repository.ignore(uris);
        });
    }
    stash(repository) {
        return __awaiter(this, void 0, void 0, function* () {
            if (repository.workingTreeGroup.resourceStates.length === 0) {
                vscode_1.window.showInformationMessage(localize(75, null));
                return;
            }
            const message = yield vscode_1.window.showInputBox({
                prompt: localize(76, null),
                placeHolder: localize(77, null)
            });
            if (typeof message === 'undefined') {
                return;
            }
            yield repository.createStash(message);
        });
    }
    stashPop(repository) {
        return __awaiter(this, void 0, void 0, function* () {
            const stashes = yield repository.getStashes();
            if (stashes.length === 0) {
                vscode_1.window.showInformationMessage(localize(78, null));
                return;
            }
            const picks = stashes.map(r => ({ label: `#${r.index}:  ${r.description}`, description: '', details: '', id: r.index }));
            const placeHolder = localize(79, null);
            const choice = yield vscode_1.window.showQuickPick(picks, { placeHolder });
            if (!choice) {
                return;
            }
            yield repository.popStash(choice.id);
        });
    }
    stashPopLatest(repository) {
        return __awaiter(this, void 0, void 0, function* () {
            const stashes = yield repository.getStashes();
            if (stashes.length === 0) {
                vscode_1.window.showInformationMessage(localize(80, null));
                return;
            }
            yield repository.popStash();
        });
    }
    createCommand(id, key, method, options) {
        const result = (...args) => {
            let result;
            if (!options.repository) {
                result = Promise.resolve(method.apply(this, args));
            }
            else {
                // try to guess the repository based on the first argument
                const repository = this.model.getRepository(args[0]);
                let repositoryPromise;
                if (repository) {
                    repositoryPromise = Promise.resolve(repository);
                }
                else if (this.model.repositories.length === 1) {
                    repositoryPromise = Promise.resolve(this.model.repositories[0]);
                }
                else {
                    repositoryPromise = this.model.pickRepository();
                }
                result = repositoryPromise.then(repository => {
                    if (!repository) {
                        return Promise.resolve();
                    }
                    return Promise.resolve(method.apply(this, [repository, ...args]));
                });
            }
            this.telemetryReporter.sendTelemetryEvent('git.command', { command: id });
            return result.catch((err) => __awaiter(this, void 0, void 0, function* () {
                let message;
                switch (err.gitErrorCode) {
                    case git_1.GitErrorCodes.DirtyWorkTree:
                        message = localize(81, null);
                        break;
                    case git_1.GitErrorCodes.PushRejected:
                        message = localize(82, null);
                        break;
                    default:
                        const hint = (err.stderr || err.message || String(err))
                            .replace(/^error: /mi, '')
                            .replace(/^> husky.*$/mi, '')
                            .split(/[\r\n]/)
                            .filter(line => !!line)[0];
                        message = hint
                            ? localize(83, null, hint)
                            : localize(84, null);
                        break;
                }
                if (!message) {
                    console.error(err);
                    return;
                }
                const outputChannel = this.outputChannel;
                const openOutputChannelChoice = localize(85, null);
                const choice = yield vscode_1.window.showErrorMessage(message, openOutputChannelChoice);
                if (choice === openOutputChannelChoice) {
                    outputChannel.show();
                }
            }));
        };
        // patch this object, so people can call methods directly
        this[key] = result;
        return result;
    }
    getSCMResource(uri) {
        uri = uri ? uri : vscode_1.window.activeTextEditor && vscode_1.window.activeTextEditor.document.uri;
        if (!uri) {
            return undefined;
        }
        if (uri.scheme === 'git') {
            const { path } = uri_1.fromGitUri(uri);
            uri = vscode_1.Uri.file(path);
        }
        if (uri.scheme === 'file') {
            const uriString = uri.toString();
            const repository = this.model.getRepository(uri);
            if (!repository) {
                return undefined;
            }
            return repository.workingTreeGroup.resourceStates.filter(r => r.resourceUri.toString() === uriString)[0]
                || repository.indexGroup.resourceStates.filter(r => r.resourceUri.toString() === uriString)[0];
        }
    }
    runByRepository(arg, fn) {
        return __awaiter(this, void 0, void 0, function* () {
            const resources = arg instanceof vscode_1.Uri ? [arg] : arg;
            const isSingleResource = arg instanceof vscode_1.Uri;
            const groups = resources.reduce((result, resource) => {
                const repository = this.model.getRepository(resource);
                if (!repository) {
                    console.warn('Could not find git repository for ', resource);
                    return result;
                }
                const tuple = result.filter(p => p[0] === repository)[0];
                if (tuple) {
                    tuple.resources.push(resource);
                }
                else {
                    result.push({ repository, resources: [resource] });
                }
                return result;
            }, []);
            const promises = groups
                .map(({ repository, resources }) => fn(repository, isSingleResource ? resources[0] : resources));
            return Promise.all(promises);
        });
    }
    dispose() {
        this.disposables.forEach(d => d.dispose());
    }
}
__decorate([
    command('git.refresh', { repository: true })
], CommandCenter.prototype, "refresh", null);
__decorate([
    command('git.openResource')
], CommandCenter.prototype, "openResource", null);
__decorate([
    command('git.clone')
], CommandCenter.prototype, "clone", null);
__decorate([
    command('git.init')
], CommandCenter.prototype, "init", null);
__decorate([
    command('git.openFile')
], CommandCenter.prototype, "openFile", null);
__decorate([
    command('git.openHEADFile')
], CommandCenter.prototype, "openHEADFile", null);
__decorate([
    command('git.openChange')
], CommandCenter.prototype, "openChange", null);
__decorate([
    command('git.stage')
], CommandCenter.prototype, "stage", null);
__decorate([
    command('git.stageAll', { repository: true })
], CommandCenter.prototype, "stageAll", null);
__decorate([
    command('git.stageSelectedRanges', { diff: true })
], CommandCenter.prototype, "stageSelectedRanges", null);
__decorate([
    command('git.revertSelectedRanges', { diff: true })
], CommandCenter.prototype, "revertSelectedRanges", null);
__decorate([
    command('git.unstage')
], CommandCenter.prototype, "unstage", null);
__decorate([
    command('git.unstageAll', { repository: true })
], CommandCenter.prototype, "unstageAll", null);
__decorate([
    command('git.unstageSelectedRanges', { diff: true })
], CommandCenter.prototype, "unstageSelectedRanges", null);
__decorate([
    command('git.clean')
], CommandCenter.prototype, "clean", null);
__decorate([
    command('git.cleanAll', { repository: true })
], CommandCenter.prototype, "cleanAll", null);
__decorate([
    command('git.commit', { repository: true })
], CommandCenter.prototype, "commit", null);
__decorate([
    command('git.commitWithInput', { repository: true })
], CommandCenter.prototype, "commitWithInput", null);
__decorate([
    command('git.commitStaged', { repository: true })
], CommandCenter.prototype, "commitStaged", null);
__decorate([
    command('git.commitStagedSigned', { repository: true })
], CommandCenter.prototype, "commitStagedSigned", null);
__decorate([
    command('git.commitStagedAmend', { repository: true })
], CommandCenter.prototype, "commitStagedAmend", null);
__decorate([
    command('git.commitAll', { repository: true })
], CommandCenter.prototype, "commitAll", null);
__decorate([
    command('git.commitAllSigned', { repository: true })
], CommandCenter.prototype, "commitAllSigned", null);
__decorate([
    command('git.commitAllAmend', { repository: true })
], CommandCenter.prototype, "commitAllAmend", null);
__decorate([
    command('git.undoCommit', { repository: true })
], CommandCenter.prototype, "undoCommit", null);
__decorate([
    command('git.checkout', { repository: true })
], CommandCenter.prototype, "checkout", null);
__decorate([
    command('git.branch', { repository: true })
], CommandCenter.prototype, "branch", null);
__decorate([
    command('git.deleteBranch', { repository: true })
], CommandCenter.prototype, "deleteBranch", null);
__decorate([
    command('git.merge', { repository: true })
], CommandCenter.prototype, "merge", null);
__decorate([
    command('git.createTag', { repository: true })
], CommandCenter.prototype, "createTag", null);
__decorate([
    command('git.pullFrom', { repository: true })
], CommandCenter.prototype, "pullFrom", null);
__decorate([
    command('git.pull', { repository: true })
], CommandCenter.prototype, "pull", null);
__decorate([
    command('git.pullRebase', { repository: true })
], CommandCenter.prototype, "pullRebase", null);
__decorate([
    command('git.push', { repository: true })
], CommandCenter.prototype, "push", null);
__decorate([
    command('git.pushWithTags', { repository: true })
], CommandCenter.prototype, "pushWithTags", null);
__decorate([
    command('git.pushTo', { repository: true })
], CommandCenter.prototype, "pushTo", null);
__decorate([
    command('git.sync', { repository: true })
], CommandCenter.prototype, "sync", null);
__decorate([
    command('git.publish', { repository: true })
], CommandCenter.prototype, "publish", null);
__decorate([
    command('git.showOutput')
], CommandCenter.prototype, "showOutput", null);
__decorate([
    command('git.ignore', { repository: true })
], CommandCenter.prototype, "ignore", null);
__decorate([
    command('git.stash', { repository: true })
], CommandCenter.prototype, "stash", null);
__decorate([
    command('git.stashPop', { repository: true })
], CommandCenter.prototype, "stashPop", null);
__decorate([
    command('git.stashPopLatest', { repository: true })
], CommandCenter.prototype, "stashPopLatest", null);
exports.CommandCenter = CommandCenter;
//# sourceMappingURL=https://ticino.blob.core.windows.net/sourcemaps/27492b6bf3acb0775d82d2f87b25a93490673c6d/extensions/git/out/commands.js.map
