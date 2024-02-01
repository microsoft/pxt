import * as Blockly from "blockly";
import { ConstantProvider } from "./constants";
import { isCollapsedInputRow } from "./collapsedInputRow";

export class Drawer extends Blockly.zelos.Drawer {
    protected constants_: ConstantProvider;

    drawCollapsedStack_(row: Blockly.blockRendering.Row) {
        // Where to start drawing the notch, which is on the right side in LTR.
        const x = this.constants_.STATEMENT_INPUT_NOTCH_OFFSET
            + this.constants_.INSIDE_CORNERS.width;

        const innerTopLeftCorner =
            (this.constants_.STATEMENT_INPUT_PADDING_LEFT +
                this.constants_.INSIDE_CORNERS.width * 2
            ) +
            Blockly.utils.svgPaths.lineOnAxis('h',
                -this.constants_.INSIDE_CORNERS.width) +
            this.constants_.INSIDE_CORNERS.pathTop;

        const innerHeight =
            row.height - (2 * this.constants_.INSIDE_CORNERS.height);

        const innerBottomLeftCorner =
            this.constants_.INSIDE_CORNERS.pathBottom +
            Blockly.utils.svgPaths.lineOnAxis('h',
                this.constants_.INSIDE_CORNERS.width);

        const ellipses = this.constants_.ellipses;

        this.outlinePath_ += this.constants_.OUTSIDE_CORNERS.bottomRight +
            Blockly.utils.svgPaths.lineOnAxis('H', x) +
            innerTopLeftCorner +
            Blockly.utils.svgPaths.lineOnAxis('v', innerHeight / 2) +
            ellipses +
            Blockly.utils.svgPaths.lineOnAxis('v', innerHeight / 2) +
            innerBottomLeftCorner +
            Blockly.utils.svgPaths.lineOnAxis('H', row.xPos + row.width - this.constants_.OUTSIDE_CORNERS.rightHeight) +
            this.constants_.OUTSIDE_CORNERS.topRight;
    }

    drawOutline_(): void {
        if (this.info_.outputConnection &&
            this.info_.outputConnection.isDynamicShape &&
            !this.info_.hasStatementInput &&
            !this.info_.bottomRow.hasNextConnection) {
            this.drawFlatTop_();
            this.drawRightDynamicConnection_();
            this.drawFlatBottom_();
            this.drawLeftDynamicConnection_();
        } else {
            this.drawTop_();
            for (let r = 1; r < this.info_.rows.length - 1; r++) {
                const row = this.info_.rows[r];
                if (row.hasJaggedEdge) {
                    this.drawJaggedEdge_(row);
                } else if (isCollapsedInputRow(row)) {
                    // pxt-blockly rendering for collapsed stack
                    this.drawCollapsedStack_(row);
                } else if (row.hasStatement) {
                    this.drawStatementInput_(row);
                } else if (row.hasExternalInput) {
                    this.drawValueInput_(row);
                } else {
                    this.drawRightSideRow_(row);
                }
            }
            this.drawBottom_();
            this.drawLeft_();
        }
    }

    drawLeft_(): void {
        super.drawLeft_();

        const hasCollapsedStack = this.info_.rows.find(function (el) {
            return isCollapsedInputRow(el);
        });

        // we lift the pen in drawing the collapsed stack ellipses, so manually
        // reconnect left side
        if (hasCollapsedStack) {
            let endY = this.info_.startY;
            if (Blockly.blockRendering.Types.isLeftRoundedCorner(this.info_.topRow.elements[0])) {
                endY += this.constants_.OUTSIDE_CORNERS.rightHeight;
            }

            this.outlinePath_ = this.outlinePath_.slice(0, -1);
            this.outlinePath_ += Blockly.utils.svgPaths.lineOnAxis('V', endY);
        }
    }
}