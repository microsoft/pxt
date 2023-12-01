import * as Blockly from "blockly";
import { ConstantProvider } from "./constants";

export class PathObject extends Blockly.zelos.PathObject {
    protected svgPathHighlighted: SVGElement;

    override updateHighlighted(enable: boolean) {
        // this.setClass_('blocklySelected', enable);
        if (enable) {
            if (!this.svgPathHighlighted) {
                this.svgPathHighlighted = this.svgPath.cloneNode(true) as SVGElement;
                this.svgPathHighlighted.setAttribute('fill', 'none');
                this.svgPathHighlighted.setAttribute(
                    'filter',
                    'url(#' + (this.constants as ConstantProvider).highlightOutlineFilterId + ')',
                );
                this.svgRoot.appendChild(this.svgPathHighlighted);
            }
        } else {
            if (this.svgPathHighlighted) {
                this.svgRoot.removeChild(this.svgPathHighlighted);
                this.svgPathHighlighted = null;
            }
        }
    }
}