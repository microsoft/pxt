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
.blockly-ws-search {
    background: var(--pxt-neutral-background1);
    color: var(--pxt-neutral-foreground1);
    border: solid var(--pxt-neutral-alpha50) 1px;
    border-top: none;
    border-right: none;
    box-shadow: 0px 2px 15px var(--pxt-neutral-alpha50);
}

.blockly-ws-search input {
    -webkit-tap-highlight-color: transparent;
    background: var(--pxt-neutral-background1);
    color: var(--pxt-neutral-foreground1);
    border: none;
}

.blockly-ws-search input::-webkit-input-placeholder {
    color: var(--pxt-neutral-alpha50);
}

.blockly-ws-search input::-moz-placeholder {
    color: var(--pxt-neutral-alpha50);
}

.blockly-ws-search input::-ms-input-placeholder {
    color: var(--pxt-neutral-alpha50);
}

.blockly-ws-search input:active,
.blockly-ws-search input:focus {
    border-color: var(--pxt-neutral-alpha50);
    background: var(--pxt-neutral-background1);
    color: var(--pxt-neutral-foreground1);
}

.blockly-ws-search input::selection {
    color: var(--pxt-neutral-foreground1);
}

.blockly-ws-search button {
    padding-left: 6px;
    padding-right: 6px;
    color: var(--pxt-neutral-foreground1);
}`);
