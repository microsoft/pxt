import * as Blockly from "blockly";
import { CollapsedInputRow, isCollapsedInputRow } from "./collapsedInputRow";
import { ConstantProvider } from "./constants";

/**
 * FIXME: 99% of this is straight from the Blocky implementation with only
 * the parts concerning collapsed inputs differing. Would be nice to find
 * a way to duplicate less of their code.
 */
export class RenderInfo extends Blockly.zelos.RenderInfo {
    constants_: ConstantProvider;

    override measure(): void {
        if (this.block_) {
            for (const input of this.block_.inputList) {
                input.init();
            }
        }
        super.measure();
    }

    protected createRows_() {
        this.populateTopRow_();
        this.rows.push(this.topRow);
        let activeRow = new Blockly.blockRendering.InputRow(this.constants_);
        this.inputRows.push(activeRow);

        // Icons always go on the first row, before anything else.
        const icons = this.block_.getIcons();
        for (let i = 0, icon; (icon = icons[i]); i++) {
            const iconInfo = new Blockly.blockRendering.Icon(this.constants_, icon);
            if (!this.isCollapsed || icon.isShownWhenCollapsed()) {
                activeRow.elements.push(iconInfo);
            }
        }

        let lastInput = undefined;
        // Loop across all of the inputs on the block, creating objects for anything
        // that needs to be rendered and breaking the block up into visual rows.
        for (let i = 0, input; (input = this.block_.inputList[i]); i++) {
            if (!input.isVisible()) {
                continue;
            }
            if (this.shouldStartNewRow_(input, lastInput)) {
                // Finish this row and create a new one.
                this.rows.push(activeRow);
                activeRow = new Blockly.blockRendering.InputRow(this.constants_);
                this.inputRows.push(activeRow);
            }

            // All of the fields in an input go on the same row.
            for (let j = 0, field; (field = input.fieldRow[j]); j++) {
                activeRow.elements.push(new Blockly.blockRendering.Field(this.constants_, field, input));
            }
            this.addInput_(input, activeRow);
            lastInput = input;
        }

        if (this.isCollapsed) {
            // pxt-blockly for collapsed statement rendering, check for statement
            // input anywhere in block
            const hasStatement = this.block_.inputList.find(function (el) {
                return el.type == Blockly.inputs.inputTypes.STATEMENT;
            });
            if (hasStatement) {
                activeRow = this.addCollapsedRow_(activeRow);
            } else {
                activeRow.hasJaggedEdge = true;
                activeRow.elements.push(
                    new Blockly.blockRendering.JaggedEdge(this.constants_));
            }
        }

        if (activeRow.elements.length || activeRow.hasDummyInput) {
            this.rows.push(activeRow);
        }
        this.populateBottomRow_();
        this.rows.push(this.bottomRow);
    }

    protected populateBottomRow_() {
        this.bottomRow.hasNextConnection = !!this.block_.nextConnection;

        const followsStatement =
            this.block_.inputList.length &&
            this.block_.inputList[this.block_.inputList.length - 1] instanceof
            Blockly.inputs.StatementInput
            || this.rows.some(row => isCollapsedInputRow(row));

        // This is the minimum height for the row. If one of its elements has a
        // greater height it will be overwritten in the compute pass.
        if (followsStatement) {
            this.bottomRow.minHeight =
                this.constants_.BOTTOM_ROW_AFTER_STATEMENT_MIN_HEIGHT;
        } else {
            this.bottomRow.minHeight = this.constants_.BOTTOM_ROW_MIN_HEIGHT;
        }

        const leftSquareCorner = this.bottomRow.hasLeftSquareCorner(this.block_);

        if (leftSquareCorner) {
            this.bottomRow.elements.push(new Blockly.blockRendering.SquareCorner(this.constants_));
        } else {
            this.bottomRow.elements.push(new Blockly.blockRendering.RoundCorner(this.constants_));
        }

        if (this.bottomRow.hasNextConnection) {
            this.bottomRow.connection = new Blockly.blockRendering.NextConnection(
                this.constants_,
                this.block_.nextConnection as Blockly.RenderedConnection,
            );
            this.bottomRow.elements.push(this.bottomRow.connection);
        }

        const rightSquareCorner = this.bottomRow.hasRightSquareCorner(this.block_);

        if (rightSquareCorner) {
            this.bottomRow.elements.push(new Blockly.blockRendering.SquareCorner(this.constants_, 'right'));
        } else {
            this.bottomRow.elements.push(new Blockly.blockRendering.RoundCorner(this.constants_, 'right'));
        }
    }


    protected addCollapsedRow_(activeRow: Blockly.blockRendering.Row) {
        this.rows.push(activeRow);
        const newRow = new CollapsedInputRow(this.constants_);
        // this.inputRowNum_ ++;
        newRow.hasDummyInput = true;
        return newRow;
    }
}