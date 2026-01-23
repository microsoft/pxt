import * as Blockly from "blockly";
import { WorkspaceSearch } from "@blockly/plugin-workspace-search";

export class PxtWorkspaceSearch extends WorkspaceSearch {
    protected injectionDiv: Element;
    protected inputElement_: HTMLInputElement;

    constructor(workspace: Blockly.WorkspaceSvg) {
        super(workspace);
        this.injectionDiv = workspace.getInjectionDiv();
    }

    protected override highlightSearchGroup(blocks: Blockly.BlockSvg[]) {
        blocks.forEach((block) => {
            const blockPath = block.pathObject.svgPath;
            Blockly.utils.dom.addClass(blockPath, 'blockly-ws-search-highlight-pxt');
        });
    }

    protected override unhighlightSearchGroup(blocks: Blockly.BlockSvg[]) {
        blocks.forEach((block) => {
            const blockPath = block.pathObject.svgPath;
            Blockly.utils.dom.removeClass(blockPath, 'blockly-ws-search-highlight-pxt');
        });
    }

    override open() {
        super.open();
        Blockly.utils.dom.addClass(this.injectionDiv, 'blockly-ws-searching');
    }

    override close() {
        super.close();
        Blockly.utils.dom.removeClass(this.injectionDiv, 'blockly-ws-searching');
    }
}

Blockly.Css.register(`
.blockly-ws-search button {
    padding-left: 6px;
    padding-right: 6px;
}`);