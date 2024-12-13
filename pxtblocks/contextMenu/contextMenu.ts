/// <reference path="../../built/pxtlib.d.ts" />
import * as Blockly from "blockly";
import { registerWorkspaceItems } from "./workspaceItems";
import { onWorkspaceContextMenu } from "../external";
import { registerBlockitems } from "./blockItems";

export function initContextMenu() {
    const msg = Blockly.Msg;

    // FIXME (riknoll): Not all of these are still used
    msg.DUPLICATE_BLOCK = lf("{id:block}Duplicate");
    msg.DUPLICATE_COMMENT = lf("Duplicate Comment");
    msg.REMOVE_COMMENT = lf("Remove Comment");
    msg.ADD_COMMENT = lf("Add Comment");
    msg.EXTERNAL_INPUTS = lf("External Inputs");
    msg.INLINE_INPUTS = lf("Inline Inputs");
    msg.EXPAND_BLOCK = lf("Expand Block");
    msg.COLLAPSE_BLOCK = lf("Collapse Block");
    msg.ENABLE_BLOCK = lf("Enable Block");
    msg.DISABLE_BLOCK = lf("Disable Block");
    msg.DELETE_BLOCK = lf("Delete Block");
    msg.DELETE_X_BLOCKS = lf("Delete Blocks");
    msg.DELETE_ALL_BLOCKS = lf("Delete All Blocks");
    msg.HELP = lf("Help");

    registerWorkspaceItems();
    registerBlockitems();
}

export function setupWorkspaceContextMenu(workspace: Blockly.WorkspaceSvg) {
    try {
        Blockly.ContextMenuItems.registerCommentOptions();
    }
    catch (e) {
        // will throw if already registered. ignore
    }
    workspace.configureContextMenu = (options, e) => {
        onWorkspaceContextMenu(workspace, options);
    };
}