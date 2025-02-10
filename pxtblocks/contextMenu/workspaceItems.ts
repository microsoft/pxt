/// <reference path="../../built/pxtlib.d.ts" />
import * as Blockly from "blockly";
import { flow, screenshotAsync, screenshotEnabled, setCollapsedAll } from "../layout";
import { openWorkspaceSearch } from "../external";

// Lower weight is higher in context menu
export enum WorkspaceContextWeight {
    Paste = 10,
    DeleteAll = 20,
    FormatCode = 30,
    CollapseBlocks = 40,
    ExpandBlocks = 50,
    Snapshot = 60,
    Find = 70
}

export function registerWorkspaceItems() {
    registerFormatCode();
    registerSnapshotCode();
    registerCollapseBlocks();
    registerExpandBlocks();
    registerDeleteAllBlocks();
    registerFind();

    // Unregister the builtin options that we don't use
    Blockly.ContextMenuRegistry.registry.unregister("workspaceDelete");
    Blockly.ContextMenuRegistry.registry.unregister("expandWorkspace");
    Blockly.ContextMenuRegistry.registry.unregister("collapseWorkspace");
    Blockly.ContextMenuRegistry.registry.unregister("cleanWorkspace");
    Blockly.ContextMenuRegistry.registry.unregister("redoWorkspace");
    Blockly.ContextMenuRegistry.registry.unregister("undoWorkspace");
}

function registerFormatCode() {
    const formatOption: Blockly.ContextMenuRegistry.RegistryItem = {
        displayText() {
            return pxt.U.lf("Format Code")
        },
        preconditionFn(scope: Blockly.ContextMenuRegistry.Scope) {
            const ws = scope.workspace;

            if (ws.options.readOnly) {
                return 'hidden';
            }

            return 'enabled';
        },
        callback(scope: Blockly.ContextMenuRegistry.Scope) {
            if (!scope.workspace) return;

            pxt.tickEvent("blocks.context.format", undefined, { interactiveConsent: true });
            flow(scope.workspace, { useViewWidth: true });
        },
        scopeType: Blockly.ContextMenuRegistry.ScopeType.WORKSPACE,
        id: 'pxtFormatCode',
        weight: WorkspaceContextWeight.FormatCode,
    };
    Blockly.ContextMenuRegistry.registry.register(formatOption);
}

function registerSnapshotCode() {
    const snapshotOption: Blockly.ContextMenuRegistry.RegistryItem = {
        displayText() {
            return pxt.U.lf("Snapshot")
        },
        preconditionFn(scope: Blockly.ContextMenuRegistry.Scope) {
            if (!screenshotEnabled()) {
                return "hidden";
            }
            const ws = scope.workspace;

            const topBlocks = ws.getTopBlocks(false);
            const topComments = ws.getTopComments(false);

            if (topBlocks.length === 0 && topComments.length === 0) {
                return "disabled";
            }

            return "enabled";
        },
        callback(scope: Blockly.ContextMenuRegistry.Scope) {
            if (!scope.workspace) return;

            pxt.tickEvent("blocks.context.screenshot", undefined, { interactiveConsent: true });
            (async () => {
                let uri = await screenshotAsync(scope.workspace, null, pxt.appTarget.appTheme?.embedBlocksInSnapshot);

                if (pxt.BrowserUtils.isSafari()) {
                    // For some reason, Safari doesn't always load embedded images the first time. This is a silly fix,
                    // but snapshotting a second time fixes the issue.
                    uri = await screenshotAsync(scope.workspace, null, pxt.appTarget.appTheme?.embedBlocksInSnapshot);
                }

                if (pxt.BrowserUtils.isSafari()) {
                    uri = uri.replace(/^data:image\/[^;]/, 'data:application/octet-stream');
                }
                pxt.BrowserUtils.browserDownloadDataUri(
                    uri,
                    `${pxt.appTarget.nickname || pxt.appTarget.id}-${lf("screenshot")}.png`
                );
            })();
        },
        scopeType: Blockly.ContextMenuRegistry.ScopeType.WORKSPACE,
        id: 'pxtSnapshotCode',
        weight: WorkspaceContextWeight.Snapshot,
    };
    Blockly.ContextMenuRegistry.registry.register(snapshotOption);
}

function registerCollapseBlocks() {
    const collapseOption: Blockly.ContextMenuRegistry.RegistryItem = {
        displayText() {
            return pxt.U.lf("Collapse Blocks")
        },
        preconditionFn(scope: Blockly.ContextMenuRegistry.Scope) {
            const ws = scope.workspace;

            if (ws.options.readOnly || !pxt.appTarget.appTheme.blocksCollapsing) {
                return "hidden";
            }

            const topBlocks = ws.getTopBlocks(false);

            if (!topBlocks.some(block => block.isEnabled() && !block.isCollapsed())) {
                return "disabled";
            }

            return "enabled";
        },
        callback(scope: Blockly.ContextMenuRegistry.Scope) {
            if (!scope.workspace) return;

            pxt.tickEvent("blocks.context.collapse", undefined, { interactiveConsent: true });
            setCollapsedAll(scope.workspace, true);
        },
        scopeType: Blockly.ContextMenuRegistry.ScopeType.WORKSPACE,
        id: 'pxtCollapseBlocks',
        weight: WorkspaceContextWeight.CollapseBlocks,
    };
    Blockly.ContextMenuRegistry.registry.register(collapseOption);
}

function registerExpandBlocks() {
    const expandOptions: Blockly.ContextMenuRegistry.RegistryItem = {
        displayText() {
            return pxt.U.lf("Expand Blocks")
        },
        preconditionFn(scope: Blockly.ContextMenuRegistry.Scope) {
            const ws = scope.workspace;

            if (ws.options.readOnly || !pxt.appTarget.appTheme.blocksCollapsing) {
                return "hidden";
            }

            const topBlocks = ws.getTopBlocks(false);

            if (!topBlocks.some(block => block.isEnabled() && block.isCollapsed())) {
                return "disabled";
            }

            return "enabled";
        },
        callback(scope: Blockly.ContextMenuRegistry.Scope) {
            if (!scope.workspace) return;

            pxt.tickEvent("blocks.context.expand", undefined, { interactiveConsent: true });
            setCollapsedAll(scope.workspace, false);
        },
        scopeType: Blockly.ContextMenuRegistry.ScopeType.WORKSPACE,
        id: 'pxtExpandBlocks',
        weight: WorkspaceContextWeight.ExpandBlocks,
    };
    Blockly.ContextMenuRegistry.registry.register(expandOptions);
}

function registerDeleteAllBlocks() {
    const buildDeleteList = (workspace: Blockly.Workspace) => {
        const deleteList: Blockly.BlockSvg[] = [];

        const addDeletableBlocks = (block: Blockly.BlockSvg) => {
            if (block.isDeletable()) {
                deleteList.push(...block.getDescendants(false))
            }
            else {
                for (const child of block.getChildren(false)) {
                    addDeletableBlocks(child);
                }
            }
        };

        for (const block of workspace.getTopBlocks()) {
            addDeletableBlocks(block as Blockly.BlockSvg);
        }

        return deleteList;
    }

    const deleteAllOption: Blockly.ContextMenuRegistry.RegistryItem = {
        displayText(scope: Blockly.ContextMenuRegistry.Scope) {
            const deleteList = buildDeleteList(scope.workspace);
            const deleteCount = deleteList.filter(b => !b.isShadow()).length;

            if (deleteCount > 1) {
                return pxt.U.lf("Delete All Blocks");
            }

            return pxt.U.lf("Delete Block");
        },
        preconditionFn(scope: Blockly.ContextMenuRegistry.Scope) {
            const ws = scope.workspace;

            if (ws.options.readOnly) {
                return "hidden";
            }

            const deleteList = buildDeleteList(scope.workspace);
            const deleteCount = deleteList.filter(b => !b.isShadow()).length;

            if (deleteCount === 0) {
                return "disabled";
            }

            return "enabled";
        },
        callback(scope: Blockly.ContextMenuRegistry.Scope) {
            if (!scope.workspace) return;

            const deleteList = buildDeleteList(scope.workspace);
            const deleteCount = deleteList.filter(b => !b.isShadow()).length;

            // Add a little animation to deleting.
            const DELAY = 10;
            let eventGroup = Blockly.utils.idGenerator.genUid();
            const deleteNext = () => {
                let block = deleteList.shift();
                if (block) {
                    if (!block.isDeadOrDying()) {
                        Blockly.Events.setGroup(eventGroup);
                        block.dispose(false, true);
                        Blockly.Events.setGroup(false);

                        setTimeout(deleteNext, DELAY);
                    } else {
                        deleteNext();
                    }
                }
            }

            pxt.tickEvent("blocks.context.delete", undefined, { interactiveConsent: true });
            if (deleteCount < 2) {
                deleteNext();
            } else {
                Blockly.dialog.confirm(lf("Delete all {0} blocks?", deleteCount), (ok) => {
                    if (ok) {
                        deleteNext();
                    }
                });
            }
        },
        scopeType: Blockly.ContextMenuRegistry.ScopeType.WORKSPACE,
        id: 'pxtDeleteAllBlocks',
        weight: WorkspaceContextWeight.DeleteAll,
    };
    Blockly.ContextMenuRegistry.registry.register(deleteAllOption);
}

function registerFind() {
    const findOption: Blockly.ContextMenuRegistry.RegistryItem = {
        displayText() {
            return pxt.U.lf("Find…")
        },
        preconditionFn(scope: Blockly.ContextMenuRegistry.Scope) {
            const ws = scope.workspace;

            if (ws.options.readOnly || !pxt.appTarget.appTheme.workspaceSearch) {
                return 'hidden';
            }

            return 'enabled';
        },
        callback(scope: Blockly.ContextMenuRegistry.Scope) {
            if (!scope.workspace) return;

            pxt.tickEvent("blocks.context.find", undefined, { interactiveConsent: true });
            openWorkspaceSearch();

        },
        scopeType: Blockly.ContextMenuRegistry.ScopeType.WORKSPACE,
        id: 'pxtWorkspaceFind',
        weight: WorkspaceContextWeight.Find,
    };
    Blockly.ContextMenuRegistry.registry.register(findOption);
}