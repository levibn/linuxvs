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
const util_1 = require("./util");
const decorators_1 = require("./decorators");
const uri_1 = require("./uri");
const autofetch_1 = require("./autofetch");
const path = require("path");
const nls = require("vscode-nls");
const fs = require("fs");
const statusbar_1 = require("./statusbar");
const timeout = (millis) => new Promise(c => setTimeout(c, millis));
const localize = nls.loadMessageBundle(__filename);
const iconsRootPath = path.join(path.dirname(__dirname), 'resources', 'icons');
function getIconUri(iconName, theme) {
    return vscode_1.Uri.file(path.join(iconsRootPath, theme, `${iconName}.svg`));
}
var RepositoryState;
(function (RepositoryState) {
    RepositoryState[RepositoryState["Idle"] = 0] = "Idle";
    RepositoryState[RepositoryState["Disposed"] = 1] = "Disposed";
})(RepositoryState = exports.RepositoryState || (exports.RepositoryState = {}));
var Status;
(function (Status) {
    Status[Status["INDEX_MODIFIED"] = 0] = "INDEX_MODIFIED";
    Status[Status["INDEX_ADDED"] = 1] = "INDEX_ADDED";
    Status[Status["INDEX_DELETED"] = 2] = "INDEX_DELETED";
    Status[Status["INDEX_RENAMED"] = 3] = "INDEX_RENAMED";
    Status[Status["INDEX_COPIED"] = 4] = "INDEX_COPIED";
    Status[Status["MODIFIED"] = 5] = "MODIFIED";
    Status[Status["DELETED"] = 6] = "DELETED";
    Status[Status["UNTRACKED"] = 7] = "UNTRACKED";
    Status[Status["IGNORED"] = 8] = "IGNORED";
    Status[Status["ADDED_BY_US"] = 9] = "ADDED_BY_US";
    Status[Status["ADDED_BY_THEM"] = 10] = "ADDED_BY_THEM";
    Status[Status["DELETED_BY_US"] = 11] = "DELETED_BY_US";
    Status[Status["DELETED_BY_THEM"] = 12] = "DELETED_BY_THEM";
    Status[Status["BOTH_ADDED"] = 13] = "BOTH_ADDED";
    Status[Status["BOTH_DELETED"] = 14] = "BOTH_DELETED";
    Status[Status["BOTH_MODIFIED"] = 15] = "BOTH_MODIFIED";
})(Status = exports.Status || (exports.Status = {}));
var ResourceGroupType;
(function (ResourceGroupType) {
    ResourceGroupType[ResourceGroupType["Merge"] = 0] = "Merge";
    ResourceGroupType[ResourceGroupType["Index"] = 1] = "Index";
    ResourceGroupType[ResourceGroupType["WorkingTree"] = 2] = "WorkingTree";
})(ResourceGroupType = exports.ResourceGroupType || (exports.ResourceGroupType = {}));
class Resource {
    constructor(_resourceGroupType, _resourceUri, _type, _renameResourceUri) {
        this._resourceGroupType = _resourceGroupType;
        this._resourceUri = _resourceUri;
        this._type = _type;
        this._renameResourceUri = _renameResourceUri;
    }
    get resourceUri() {
        if (this.renameResourceUri && (this._type === Status.MODIFIED || this._type === Status.DELETED || this._type === Status.INDEX_RENAMED || this._type === Status.INDEX_COPIED)) {
            return this.renameResourceUri;
        }
        return this._resourceUri;
    }
    get command() {
        return {
            command: 'git.openResource',
            title: localize(0, null),
            arguments: [this]
        };
    }
    get resourceGroupType() { return this._resourceGroupType; }
    get type() { return this._type; }
    get original() { return this._resourceUri; }
    get renameResourceUri() { return this._renameResourceUri; }
    getIconPath(theme) {
        switch (this.type) {
            case Status.INDEX_MODIFIED: return Resource.Icons[theme].Modified;
            case Status.MODIFIED: return Resource.Icons[theme].Modified;
            case Status.INDEX_ADDED: return Resource.Icons[theme].Added;
            case Status.INDEX_DELETED: return Resource.Icons[theme].Deleted;
            case Status.DELETED: return Resource.Icons[theme].Deleted;
            case Status.INDEX_RENAMED: return Resource.Icons[theme].Renamed;
            case Status.INDEX_COPIED: return Resource.Icons[theme].Copied;
            case Status.UNTRACKED: return Resource.Icons[theme].Untracked;
            case Status.IGNORED: return Resource.Icons[theme].Ignored;
            case Status.BOTH_DELETED: return Resource.Icons[theme].Conflict;
            case Status.ADDED_BY_US: return Resource.Icons[theme].Conflict;
            case Status.DELETED_BY_THEM: return Resource.Icons[theme].Conflict;
            case Status.ADDED_BY_THEM: return Resource.Icons[theme].Conflict;
            case Status.DELETED_BY_US: return Resource.Icons[theme].Conflict;
            case Status.BOTH_ADDED: return Resource.Icons[theme].Conflict;
            case Status.BOTH_MODIFIED: return Resource.Icons[theme].Conflict;
            default: return void 0;
        }
    }
    get tooltip() {
        switch (this.type) {
            case Status.INDEX_MODIFIED: return localize(1, null);
            case Status.MODIFIED: return localize(2, null);
            case Status.INDEX_ADDED: return localize(3, null);
            case Status.INDEX_DELETED: return localize(4, null);
            case Status.DELETED: return localize(5, null);
            case Status.INDEX_RENAMED: return localize(6, null);
            case Status.INDEX_COPIED: return localize(7, null);
            case Status.UNTRACKED: return localize(8, null);
            case Status.IGNORED: return localize(9, null);
            case Status.BOTH_DELETED: return localize(10, null);
            case Status.ADDED_BY_US: return localize(11, null);
            case Status.DELETED_BY_THEM: return localize(12, null);
            case Status.ADDED_BY_THEM: return localize(13, null);
            case Status.DELETED_BY_US: return localize(14, null);
            case Status.BOTH_ADDED: return localize(15, null);
            case Status.BOTH_MODIFIED: return localize(16, null);
            default: return '';
        }
    }
    get strikeThrough() {
        switch (this.type) {
            case Status.DELETED:
            case Status.BOTH_DELETED:
            case Status.DELETED_BY_THEM:
            case Status.DELETED_BY_US:
            case Status.INDEX_DELETED:
                return true;
            default:
                return false;
        }
    }
    get faded() {
        // TODO@joao
        return false;
        // const workspaceRootPath = this.workspaceRoot.fsPath;
        // return this.resourceUri.fsPath.substr(0, workspaceRootPath.length) !== workspaceRootPath;
    }
    get decorations() {
        const light = { iconPath: this.getIconPath('light') };
        const dark = { iconPath: this.getIconPath('dark') };
        const tooltip = this.tooltip;
        const strikeThrough = this.strikeThrough;
        const faded = this.faded;
        return { strikeThrough, faded, tooltip, light, dark };
    }
}
Resource.Icons = {
    light: {
        Modified: getIconUri('status-modified', 'light'),
        Added: getIconUri('status-added', 'light'),
        Deleted: getIconUri('status-deleted', 'light'),
        Renamed: getIconUri('status-renamed', 'light'),
        Copied: getIconUri('status-copied', 'light'),
        Untracked: getIconUri('status-untracked', 'light'),
        Ignored: getIconUri('status-ignored', 'light'),
        Conflict: getIconUri('status-conflict', 'light'),
    },
    dark: {
        Modified: getIconUri('status-modified', 'dark'),
        Added: getIconUri('status-added', 'dark'),
        Deleted: getIconUri('status-deleted', 'dark'),
        Renamed: getIconUri('status-renamed', 'dark'),
        Copied: getIconUri('status-copied', 'dark'),
        Untracked: getIconUri('status-untracked', 'dark'),
        Ignored: getIconUri('status-ignored', 'dark'),
        Conflict: getIconUri('status-conflict', 'dark')
    }
};
__decorate([
    decorators_1.memoize
], Resource.prototype, "resourceUri", null);
__decorate([
    decorators_1.memoize
], Resource.prototype, "command", null);
__decorate([
    decorators_1.memoize
], Resource.prototype, "faded", null);
exports.Resource = Resource;
var Operation;
(function (Operation) {
    Operation[Operation["Status"] = 1] = "Status";
    Operation[Operation["Add"] = 2] = "Add";
    Operation[Operation["RevertFiles"] = 4] = "RevertFiles";
    Operation[Operation["Commit"] = 8] = "Commit";
    Operation[Operation["Clean"] = 16] = "Clean";
    Operation[Operation["Branch"] = 32] = "Branch";
    Operation[Operation["Checkout"] = 64] = "Checkout";
    Operation[Operation["Reset"] = 128] = "Reset";
    Operation[Operation["Fetch"] = 256] = "Fetch";
    Operation[Operation["Pull"] = 512] = "Pull";
    Operation[Operation["Push"] = 1024] = "Push";
    Operation[Operation["Sync"] = 2048] = "Sync";
    Operation[Operation["Show"] = 4096] = "Show";
    Operation[Operation["Stage"] = 8192] = "Stage";
    Operation[Operation["GetCommitTemplate"] = 16384] = "GetCommitTemplate";
    Operation[Operation["DeleteBranch"] = 32768] = "DeleteBranch";
    Operation[Operation["Merge"] = 65536] = "Merge";
    Operation[Operation["Ignore"] = 131072] = "Ignore";
    Operation[Operation["Tag"] = 262144] = "Tag";
    Operation[Operation["Stash"] = 524288] = "Stash";
})(Operation = exports.Operation || (exports.Operation = {}));
// function getOperationName(operation: Operation): string {
// 	switch (operation) {
// 		case Operation.Status: return 'Status';
// 		case Operation.Add: return 'Add';
// 		case Operation.RevertFiles: return 'RevertFiles';
// 		case Operation.Commit: return 'Commit';
// 		case Operation.Clean: return 'Clean';
// 		case Operation.Branch: return 'Branch';
// 		case Operation.Checkout: return 'Checkout';
// 		case Operation.Reset: return 'Reset';
// 		case Operation.Fetch: return 'Fetch';
// 		case Operation.Pull: return 'Pull';
// 		case Operation.Push: return 'Push';
// 		case Operation.Sync: return 'Sync';
// 		case Operation.Init: return 'Init';
// 		case Operation.Show: return 'Show';
// 		case Operation.Stage: return 'Stage';
// 		case Operation.GetCommitTemplate: return 'GetCommitTemplate';
// 		default: return 'unknown';
// 	}
// }
function isReadOnly(operation) {
    switch (operation) {
        case Operation.Show:
        case Operation.GetCommitTemplate:
            return true;
        default:
            return false;
    }
}
function shouldShowProgress(operation) {
    switch (operation) {
        case Operation.Fetch:
            return false;
        default:
            return true;
    }
}
class OperationsImpl {
    constructor(operations = 0) {
        this.operations = operations;
        // noop
    }
    start(operation) {
        return new OperationsImpl(this.operations | operation);
    }
    end(operation) {
        return new OperationsImpl(this.operations & ~operation);
    }
    isRunning(operation) {
        return (this.operations & operation) !== 0;
    }
    isIdle() {
        return this.operations === 0;
    }
}
class Repository {
    constructor(repository) {
        this.repository = repository;
        this._onDidChangeRepository = new vscode_1.EventEmitter();
        this.onDidChangeRepository = this._onDidChangeRepository.event;
        this._onDidChangeState = new vscode_1.EventEmitter();
        this.onDidChangeState = this._onDidChangeState.event;
        this._onDidChangeStatus = new vscode_1.EventEmitter();
        this.onDidChangeStatus = this._onDidChangeStatus.event;
        this._onRunOperation = new vscode_1.EventEmitter();
        this.onRunOperation = this._onRunOperation.event;
        this._onDidRunOperation = new vscode_1.EventEmitter();
        this.onDidRunOperation = this._onDidRunOperation.event;
        this._refs = [];
        this._remotes = [];
        this._operations = new OperationsImpl();
        this._state = RepositoryState.Idle;
        this.isRepositoryHuge = false;
        this.didWarnAboutLimit = false;
        this.disposables = [];
        const fsWatcher = vscode_1.workspace.createFileSystemWatcher('**');
        this.disposables.push(fsWatcher);
        const onWorkspaceChange = util_1.anyEvent(fsWatcher.onDidChange, fsWatcher.onDidCreate, fsWatcher.onDidDelete);
        const onRepositoryChange = util_1.filterEvent(onWorkspaceChange, uri => !/^\.\./.test(path.relative(repository.root, uri.fsPath)));
        const onRelevantRepositoryChange = util_1.filterEvent(onRepositoryChange, uri => !/\/\.git\/index\.lock$/.test(uri.path));
        onRelevantRepositoryChange(this.onFSChange, this, this.disposables);
        const onRelevantGitChange = util_1.filterEvent(onRelevantRepositoryChange, uri => /\/\.git\//.test(uri.path));
        onRelevantGitChange(this._onDidChangeRepository.fire, this._onDidChangeRepository, this.disposables);
        const label = `${path.basename(repository.root)} (Git)`;
        this._sourceControl = vscode_1.scm.createSourceControl('git', label);
        this._sourceControl.acceptInputCommand = { command: 'git.commitWithInput', title: localize(17, null), arguments: [this._sourceControl] };
        this._sourceControl.quickDiffProvider = this;
        this.disposables.push(this._sourceControl);
        this._mergeGroup = this._sourceControl.createResourceGroup('merge', localize(18, null));
        this._indexGroup = this._sourceControl.createResourceGroup('index', localize(19, null));
        this._workingTreeGroup = this._sourceControl.createResourceGroup('workingTree', localize(20, null));
        this.mergeGroup.hideWhenEmpty = true;
        this.indexGroup.hideWhenEmpty = true;
        this.disposables.push(this.mergeGroup);
        this.disposables.push(this.indexGroup);
        this.disposables.push(this.workingTreeGroup);
        this.disposables.push(new autofetch_1.AutoFetcher(this));
        const statusBar = new statusbar_1.StatusBarCommands(this);
        this.disposables.push(statusBar);
        statusBar.onDidChange(() => this._sourceControl.statusBarCommands = statusBar.commands, null, this.disposables);
        this._sourceControl.statusBarCommands = statusBar.commands;
        this.updateCommitTemplate();
        this.status();
    }
    get onDidChangeOperations() {
        return util_1.anyEvent(this.onRunOperation, this.onDidRunOperation);
    }
    get sourceControl() { return this._sourceControl; }
    get inputBox() { return this._sourceControl.inputBox; }
    get mergeGroup() { return this._mergeGroup; }
    get indexGroup() { return this._indexGroup; }
    get workingTreeGroup() { return this._workingTreeGroup; }
    get HEAD() {
        return this._HEAD;
    }
    get refs() {
        return this._refs;
    }
    get remotes() {
        return this._remotes;
    }
    get operations() { return this._operations; }
    get state() { return this._state; }
    set state(state) {
        this._state = state;
        this._onDidChangeState.fire(state);
        this._HEAD = undefined;
        this._refs = [];
        this._remotes = [];
        this.mergeGroup.resourceStates = [];
        this.indexGroup.resourceStates = [];
        this.workingTreeGroup.resourceStates = [];
        this._sourceControl.count = 0;
    }
    get root() {
        return this.repository.root;
    }
    provideOriginalResource(uri) {
        if (uri.scheme !== 'file') {
            return;
        }
        return uri_1.toGitUri(uri, '', true);
    }
    updateCommitTemplate() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                this._sourceControl.commitTemplate = yield this.repository.getCommitTemplate();
            }
            catch (e) {
                // noop
            }
        });
    }
    // @throttle
    // async init(): Promise<void> {
    // 	if (this.state !== State.NotAGitRepository) {
    // 		return;
    // 	}
    // 	await this.git.init(this.workspaceRoot.fsPath);
    // 	await this.status();
    // }
    status() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.run(Operation.Status);
        });
    }
    add(resources) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.run(Operation.Add, () => this.repository.add(resources.map(r => r.fsPath)));
        });
    }
    stage(resource, contents) {
        return __awaiter(this, void 0, void 0, function* () {
            const relativePath = path.relative(this.repository.root, resource.fsPath).replace(/\\/g, '/');
            yield this.run(Operation.Stage, () => this.repository.stage(relativePath, contents));
        });
    }
    revert(resources) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.run(Operation.RevertFiles, () => this.repository.revert('HEAD', resources.map(r => r.fsPath)));
        });
    }
    commit(message, opts = Object.create(null)) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.run(Operation.Commit, () => __awaiter(this, void 0, void 0, function* () {
                if (opts.all) {
                    yield this.repository.add([]);
                }
                yield this.repository.commit(message, opts);
            }));
        });
    }
    clean(resources) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.run(Operation.Clean, () => __awaiter(this, void 0, void 0, function* () {
                const toClean = [];
                const toCheckout = [];
                resources.forEach(r => {
                    const raw = r.toString();
                    const scmResource = util_1.find(this.workingTreeGroup.resourceStates, sr => sr.resourceUri.toString() === raw);
                    if (!scmResource) {
                        return;
                    }
                    switch (scmResource.type) {
                        case Status.UNTRACKED:
                        case Status.IGNORED:
                            toClean.push(r.fsPath);
                            break;
                        default:
                            toCheckout.push(r.fsPath);
                            break;
                    }
                });
                const promises = [];
                if (toClean.length > 0) {
                    promises.push(this.repository.clean(toClean));
                }
                if (toCheckout.length > 0) {
                    promises.push(this.repository.checkout('', toCheckout));
                }
                yield Promise.all(promises);
            }));
        });
    }
    branch(name) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.run(Operation.Branch, () => this.repository.branch(name, true));
        });
    }
    deleteBranch(name, force) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.run(Operation.DeleteBranch, () => this.repository.deleteBranch(name, force));
        });
    }
    merge(ref) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.run(Operation.Merge, () => this.repository.merge(ref));
        });
    }
    tag(name, message) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.run(Operation.Tag, () => this.repository.tag(name, message));
        });
    }
    checkout(treeish) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.run(Operation.Checkout, () => this.repository.checkout(treeish, []));
        });
    }
    getCommit(ref) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.repository.getCommit(ref);
        });
    }
    reset(treeish, hard) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.run(Operation.Reset, () => this.repository.reset(treeish, hard));
        });
    }
    fetch() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.run(Operation.Fetch, () => this.repository.fetch());
            }
            catch (err) {
                // noop
            }
        });
    }
    pullWithRebase() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.run(Operation.Pull, () => this.repository.pull(true));
        });
    }
    pull(rebase, remote, name) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.run(Operation.Pull, () => this.repository.pull(rebase, remote, name));
        });
    }
    push() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.run(Operation.Push, () => this.repository.push());
        });
    }
    pullFrom(rebase, remote, branch) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.run(Operation.Pull, () => this.repository.pull(rebase, remote, branch));
        });
    }
    pushTo(remote, name, setUpstream = false) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.run(Operation.Push, () => this.repository.push(remote, name, setUpstream));
        });
    }
    pushTags(remote) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.run(Operation.Push, () => this.repository.push(remote, undefined, false, true));
        });
    }
    sync() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.run(Operation.Sync, () => __awaiter(this, void 0, void 0, function* () {
                yield this.repository.pull();
                const shouldPush = this.HEAD && typeof this.HEAD.ahead === 'number' ? this.HEAD.ahead > 0 : true;
                if (shouldPush) {
                    yield this.repository.push();
                }
            }));
        });
    }
    show(ref, filePath) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.run(Operation.Show, () => __awaiter(this, void 0, void 0, function* () {
                const relativePath = path.relative(this.repository.root, filePath).replace(/\\/g, '/');
                const configFiles = vscode_1.workspace.getConfiguration('files');
                const encoding = configFiles.get('encoding');
                return yield this.repository.buffer(`${ref}:${relativePath}`, encoding);
            }));
        });
    }
    getStashes() {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.repository.getStashes();
        });
    }
    createStash(message) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.run(Operation.Stash, () => this.repository.createStash(message));
        });
    }
    popStash(index) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.run(Operation.Stash, () => this.repository.popStash(index));
        });
    }
    getCommitTemplate() {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.run(Operation.GetCommitTemplate, () => __awaiter(this, void 0, void 0, function* () { return this.repository.getCommitTemplate(); }));
        });
    }
    ignore(files) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.run(Operation.Ignore, () => __awaiter(this, void 0, void 0, function* () {
                const ignoreFile = `${this.repository.root}${path.sep}.gitignore`;
                const textToAppend = files
                    .map(uri => path.relative(this.repository.root, uri.fsPath).replace(/\\/g, '/'))
                    .join('\n');
                const document = (yield new Promise(c => fs.exists(ignoreFile, c)))
                    ? yield vscode_1.workspace.openTextDocument(ignoreFile)
                    : yield vscode_1.workspace.openTextDocument(vscode_1.Uri.file(ignoreFile).with({ scheme: 'untitled' }));
                yield vscode_1.window.showTextDocument(document);
                const edit = new vscode_1.WorkspaceEdit();
                const lastLine = document.lineAt(document.lineCount - 1);
                const text = lastLine.isEmptyOrWhitespace ? `${textToAppend}\n` : `\n${textToAppend}\n`;
                edit.insert(document.uri, lastLine.range.end, text);
                vscode_1.workspace.applyEdit(edit);
            }));
        });
    }
    run(operation, runOperation = () => Promise.resolve(null)) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.state !== RepositoryState.Idle) {
                throw new Error('Repository not initialized');
            }
            const run = () => __awaiter(this, void 0, void 0, function* () {
                this._operations = this._operations.start(operation);
                this._onRunOperation.fire(operation);
                try {
                    const result = yield this.retryRun(runOperation);
                    if (!isReadOnly(operation)) {
                        yield this.updateModelState();
                    }
                    return result;
                }
                catch (err) {
                    if (err.gitErrorCode === git_1.GitErrorCodes.NotAGitRepository) {
                        this.state = RepositoryState.Disposed;
                    }
                    throw err;
                }
                finally {
                    this._operations = this._operations.end(operation);
                    this._onDidRunOperation.fire(operation);
                }
            });
            return shouldShowProgress(operation)
                ? vscode_1.window.withProgress({ location: vscode_1.ProgressLocation.SourceControl }, run)
                : run();
        });
    }
    retryRun(runOperation = () => Promise.resolve(null)) {
        return __awaiter(this, void 0, void 0, function* () {
            let attempt = 0;
            while (true) {
                try {
                    attempt++;
                    return yield runOperation();
                }
                catch (err) {
                    if (err.gitErrorCode === git_1.GitErrorCodes.RepositoryIsLocked && attempt <= 10) {
                        // quatratic backoff
                        yield timeout(Math.pow(attempt, 2) * 50);
                    }
                    else {
                        throw err;
                    }
                }
            }
        });
    }
    updateModelState() {
        return __awaiter(this, void 0, void 0, function* () {
            const { status, didHitLimit } = yield this.repository.getStatus();
            const config = vscode_1.workspace.getConfiguration('git');
            const shouldIgnore = config.get('ignoreLimitWarning') === true;
            this.isRepositoryHuge = didHitLimit;
            if (didHitLimit && !shouldIgnore && !this.didWarnAboutLimit) {
                const ok = { title: localize(21, null), isCloseAffordance: true };
                const neverAgain = { title: localize(22, null) };
                vscode_1.window.showWarningMessage(localize(23, null, this.repository.root), ok, neverAgain).then(result => {
                    if (result === neverAgain) {
                        config.update('ignoreLimitWarning', true, false);
                    }
                });
                this.didWarnAboutLimit = true;
            }
            let HEAD;
            try {
                HEAD = yield this.repository.getHEAD();
                if (HEAD.name) {
                    try {
                        HEAD = yield this.repository.getBranch(HEAD.name);
                    }
                    catch (err) {
                        // noop
                    }
                }
            }
            catch (err) {
                // noop
            }
            const [refs, remotes] = yield Promise.all([this.repository.getRefs(), this.repository.getRemotes()]);
            this._HEAD = HEAD;
            this._refs = refs;
            this._remotes = remotes;
            const index = [];
            const workingTree = [];
            const merge = [];
            status.forEach(raw => {
                const uri = vscode_1.Uri.file(path.join(this.repository.root, raw.path));
                const renameUri = raw.rename ? vscode_1.Uri.file(path.join(this.repository.root, raw.rename)) : undefined;
                switch (raw.x + raw.y) {
                    case '??': return workingTree.push(new Resource(ResourceGroupType.WorkingTree, uri, Status.UNTRACKED));
                    case '!!': return workingTree.push(new Resource(ResourceGroupType.WorkingTree, uri, Status.IGNORED));
                    case 'DD': return merge.push(new Resource(ResourceGroupType.Merge, uri, Status.BOTH_DELETED));
                    case 'AU': return merge.push(new Resource(ResourceGroupType.Merge, uri, Status.ADDED_BY_US));
                    case 'UD': return merge.push(new Resource(ResourceGroupType.Merge, uri, Status.DELETED_BY_THEM));
                    case 'UA': return merge.push(new Resource(ResourceGroupType.Merge, uri, Status.ADDED_BY_THEM));
                    case 'DU': return merge.push(new Resource(ResourceGroupType.Merge, uri, Status.DELETED_BY_US));
                    case 'AA': return merge.push(new Resource(ResourceGroupType.Merge, uri, Status.BOTH_ADDED));
                    case 'UU': return merge.push(new Resource(ResourceGroupType.Merge, uri, Status.BOTH_MODIFIED));
                }
                let isModifiedInIndex = false;
                switch (raw.x) {
                    case 'M':
                        index.push(new Resource(ResourceGroupType.Index, uri, Status.INDEX_MODIFIED));
                        isModifiedInIndex = true;
                        break;
                    case 'A':
                        index.push(new Resource(ResourceGroupType.Index, uri, Status.INDEX_ADDED));
                        break;
                    case 'D':
                        index.push(new Resource(ResourceGroupType.Index, uri, Status.INDEX_DELETED));
                        break;
                    case 'R':
                        index.push(new Resource(ResourceGroupType.Index, uri, Status.INDEX_RENAMED, renameUri));
                        break;
                    case 'C':
                        index.push(new Resource(ResourceGroupType.Index, uri, Status.INDEX_COPIED, renameUri));
                        break;
                }
                switch (raw.y) {
                    case 'M':
                        workingTree.push(new Resource(ResourceGroupType.WorkingTree, uri, Status.MODIFIED, renameUri));
                        break;
                    case 'D':
                        workingTree.push(new Resource(ResourceGroupType.WorkingTree, uri, Status.DELETED, renameUri));
                        break;
                }
            });
            // set resource groups
            this.mergeGroup.resourceStates = merge;
            this.indexGroup.resourceStates = index;
            this.workingTreeGroup.resourceStates = workingTree;
            // set count badge
            const countBadge = vscode_1.workspace.getConfiguration('git').get('countBadge');
            let count = merge.length + index.length + workingTree.length;
            switch (countBadge) {
                case 'off':
                    count = 0;
                    break;
                case 'tracked':
                    count = count - workingTree.filter(r => r.type === Status.UNTRACKED || r.type === Status.IGNORED).length;
                    break;
            }
            this._sourceControl.count = count;
            // set context key
            let stateContextKey = '';
            switch (this.state) {
                case RepositoryState.Idle:
                    stateContextKey = 'idle';
                    break;
                case RepositoryState.Disposed:
                    stateContextKey = 'norepo';
                    break;
            }
            this._onDidChangeStatus.fire();
        });
    }
    onFSChange(uri) {
        const config = vscode_1.workspace.getConfiguration('git');
        const autorefresh = config.get('autorefresh');
        if (!autorefresh) {
            return;
        }
        if (this.isRepositoryHuge) {
            return;
        }
        if (!this.operations.isIdle()) {
            return;
        }
        this.eventuallyUpdateWhenIdleAndWait();
    }
    eventuallyUpdateWhenIdleAndWait() {
        this.updateWhenIdleAndWait();
    }
    updateWhenIdleAndWait() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.whenIdleAndFocused();
            yield this.status();
            yield timeout(5000);
        });
    }
    whenIdleAndFocused() {
        return __awaiter(this, void 0, void 0, function* () {
            while (true) {
                if (!this.operations.isIdle()) {
                    yield util_1.eventToPromise(this.onDidRunOperation);
                    continue;
                }
                if (!vscode_1.window.state.focused) {
                    const onDidFocusWindow = util_1.filterEvent(vscode_1.window.onDidChangeWindowState, e => e.focused);
                    yield util_1.eventToPromise(onDidFocusWindow);
                    continue;
                }
                return;
            }
        });
    }
    dispose() {
        this.disposables = util_1.dispose(this.disposables);
    }
}
__decorate([
    decorators_1.memoize
], Repository.prototype, "onDidChangeOperations", null);
__decorate([
    decorators_1.throttle
], Repository.prototype, "status", null);
__decorate([
    decorators_1.throttle
], Repository.prototype, "fetch", null);
__decorate([
    decorators_1.throttle
], Repository.prototype, "pullWithRebase", null);
__decorate([
    decorators_1.throttle
], Repository.prototype, "pull", null);
__decorate([
    decorators_1.throttle
], Repository.prototype, "push", null);
__decorate([
    decorators_1.throttle
], Repository.prototype, "sync", null);
__decorate([
    decorators_1.throttle
], Repository.prototype, "updateModelState", null);
__decorate([
    decorators_1.debounce(1000)
], Repository.prototype, "eventuallyUpdateWhenIdleAndWait", null);
__decorate([
    decorators_1.throttle
], Repository.prototype, "updateWhenIdleAndWait", null);
exports.Repository = Repository;
//# sourceMappingURL=https://ticino.blob.core.windows.net/sourcemaps/27492b6bf3acb0775d82d2f87b25a93490673c6d/extensions/git/out/repository.js.map
