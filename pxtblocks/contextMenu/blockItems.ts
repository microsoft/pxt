/// <reference path="../../built/pxtlib.d.ts" />
import * as Blockly from "blockly";
import { openHelpUrl } from "../external";

// Lower weight is higher in context menu
export enum BlockContextWeight {
    Duplicate = 10,
    Copy = 15,
    AddComment = 20,
    ExpandCollapse = 30,
    DeleteBlock = 40,
    Help = 50,
}

export function registerBlockitems() {
    // Unregister the builtin options that we don't use
    Blockly.ContextMenuRegistry.registry.unregister("blockDuplicate");
    Blockly.ContextMenuRegistry.registry.unregister("blockCollapseExpand");
    Blockly.ContextMenuRegistry.registry.unregister("blockHelp");
    Blockly.ContextMenuRegistry.registry.unregister("blockInline");

    registerDuplicate();
    registerCollapseExpandBlock();
    registerHelp();

    // Fix the weights of the builtin options we do use
    Blockly.ContextMenuRegistry.registry.getItem("blockDelete").weight = BlockContextWeight.DeleteBlock;
    Blockly.ContextMenuRegistry.registry.getItem("blockComment").weight = BlockContextWeight.AddComment;
}

/**
 * This differs from the builtin collapse/expand in that we
 * only allow it on top level event blocks
 */
function registerCollapseExpandBlock() {
    const expandOption: Blockly.ContextMenuRegistry.RegistryItem = {
        displayText(scope: Blockly.ContextMenuRegistry.Scope) {
            if (scope.block.isCollapsed()) {
                return pxt.U.lf("Expand Block");
            }
            else {
                return pxt.U.lf("Collapse Block");
            }
        },
        preconditionFn(scope: Blockly.ContextMenuRegistry.Scope) {
            const block = scope.block;

            const isTopBlock = block.workspace.getTopBlocks(false).some(b => b === block);
            const isEventBlock = isTopBlock && block.statementInputCount > 0 && !block.previousConnection;

            if (!isEventBlock || block.isInFlyout || !block.isMovable() || !block.workspace.options.collapse) {
                return "hidden";
            }

            return "enabled";
        },
        callback(scope: Blockly.ContextMenuRegistry.Scope) {
            if (!scope.block) return;

            pxt.tickEvent("blocks.context.expandCollapseBlock", undefined, { interactiveConsent: true });
            scope.block.setCollapsed(!scope.block.isCollapsed());
        },
        scopeType: Blockly.ContextMenuRegistry.ScopeType.BLOCK,
        id: 'pxtExpandCollapseBlock',
        weight: BlockContextWeight.ExpandCollapse,
    };
    Blockly.ContextMenuRegistry.registry.register(expandOption);
}


/**
 * Same as the builtin help but calls our external openHelpUrl instead
 */
function registerHelp() {
    const helpOption: Blockly.ContextMenuRegistry.RegistryItem = {
        displayText() {
            return pxt.U.lf("Help");
        },
        preconditionFn(scope: Blockly.ContextMenuRegistry.Scope) {
            const block = scope.block;
            const url =
                typeof block!.helpUrl === 'function'
                    ? block!.helpUrl()
                    : block!.helpUrl;
            if (url) {
                return 'enabled';
            }
            return 'hidden';
        },
        callback(scope: Blockly.ContextMenuRegistry.Scope) {
            if (!scope.block) return;

            const block = scope.block;

            const url = typeof block.helpUrl === "function" ? block.helpUrl() : block.helpUrl;
            if (url) openHelpUrl(url);
        },
        scopeType: Blockly.ContextMenuRegistry.ScopeType.BLOCK,
        id: 'pxtHelpBlock',
        weight: BlockContextWeight.Help,
    };
    Blockly.ContextMenuRegistry.registry.register(helpOption);
}

function registerDuplicate() {
    const duplicateOption: Blockly.ContextMenuRegistry.RegistryItem = {
        displayText() {
            return lf("Duplicate")
        },
        preconditionFn(scope: Blockly.ContextMenuRegistry.Scope) {
            const block = scope.block;
            if (!block!.isInFlyout && block!.isDeletable() && block!.isMovable()) {
                if (block!.isDuplicatable()) {
                    return 'enabled';
                }
                return 'disabled';
            }
            return 'hidden';
        },
        callback(scope: Blockly.ContextMenuRegistry.Scope) {
            if (!scope.block) return;

            let duplicateOnDrag = false;
            if ((scope.block as any).duplicateOnDrag_) {
                (scope.block as any).duplicateOnDrag_ = false;
                duplicateOnDrag = true;
            }

            const data = scope.block.toCopyData();

            if (duplicateOnDrag) {
                (scope.block as any).duplicateOnDrag_ = true;
            }

            if (!data) return;

            Blockly.clipboard.paste(data, scope.block.workspace);
        },
        scopeType: Blockly.ContextMenuRegistry.ScopeType.BLOCK,
        id: 'blockDuplicate',
        weight: BlockContextWeight.Duplicate,
    };
    Blockly.ContextMenuRegistry.registry.register(duplicateOption);
}