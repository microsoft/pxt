/// <reference path="../../built/pxtlib.d.ts" />
/// <reference path="../../built/pxtsim.d.ts" />

import * as Blockly from "blockly";
import { FieldMatrix } from "./field_matrix";
import { FieldCustom } from "./field_utils";

const rowRegex = /^.*[\.#].*$/;

enum LabelMode {
    None,
    Number,
    Letter
}

export class FieldLedMatrix extends FieldMatrix implements FieldCustom {
    private static CELL_WIDTH = 25;
    private static CELL_HORIZONTAL_MARGIN = 7;
    private static CELL_VERTICAL_MARGIN = 5;
    private static CELL_CORNER_RADIUS = 5;
    private static BOTTOM_MARGIN = 9;
    private static Y_AXIS_WIDTH = 9;
    private static X_AXIS_HEIGHT = 10;
    private static TAB = "        ";

    public isFieldCustom_ = true;
    public SERIALIZABLE = true;

    private params: any;
    private onColor = "#FFFFFF";
    private offColor: string;
    private static DEFAULT_OFF_COLOR = "#000000";

    private scale = 1;

    protected numMatrixCols: number = 5;
    protected numMatrixRows: number = 5;

    private yAxisLabel: LabelMode = LabelMode.None;
    private xAxisLabel: LabelMode = LabelMode.None;

    private cellState: boolean[][] = [];

    private currentDragState_: boolean;

    protected clearSelectionOnBlur = true;

    constructor(text: string, params: any, validator?: Blockly.FieldValidator) {
        super(text, validator);
        this.params = params;

        if (this.params.rows !== undefined) {
            let val = parseInt(this.params.rows);
            if (!isNaN(val)) {
                this.numMatrixRows = val;
            }
        }

        if (this.params.columns !== undefined) {
            let val = parseInt(this.params.columns);
            if (!isNaN(val)) {
                this.numMatrixCols = val;
            }
        }

        if (this.params.onColor !== undefined) {
            this.onColor = this.params.onColor;
        }

        if (this.params.offColor !== undefined) {
            this.offColor = this.params.offColor;
        }

        if (this.params.scale !== undefined)
            this.scale = Math.max(0.6, Math.min(2, Number(this.params.scale)));
        else if (Math.max(this.numMatrixCols, this.numMatrixRows) > 15)
            this.scale = 0.85;
        else if (Math.max(this.numMatrixCols, this.numMatrixRows) > 10)
            this.scale = 0.9;
    }

    protected getCellToggled(x: number, y: number): boolean {
        return this.cellState[x][y];
    }

    protected useTwoToneFocusIndicator(x: number, y: number): boolean {
        return this.getCellToggled(x, y);
    }

    /**
     * Show the inline free-text editor on top of the text.
     * @private
     */
    showEditor_() {
        this.selected = [0, 0];
        this.focusCell(0, 0);
        this.returnEphemeralFocusFn = Blockly.getFocusManager().takeEphemeralFocus(this.matrixSvg);
        this.addKeyboardFocusHandlers();
    }

    onNodeBlur() {
        this.returnEphemeralFocus();
    }

    private initMatrix() {
        if (!this.sourceBlock_.isInsertionMarker()) {
            this.matrixSvg = pxsim.svg.parseString(`<svg xmlns="http://www.w3.org/2000/svg" id="field-matrix" class="blocklyMatrix" tabindex="-1" role="grid" />`);
            this.matrixSvg.ariaLabel = lf("LED grid");

            // Initialize the matrix that holds the state
            for (let i = 0; i < this.numMatrixCols; i++) {
                this.cellState.push([])
                for (let j = 0; j < this.numMatrixRows; j++) {
                    this.cellState[i].push(false);
                }
            }

            this.restoreStateFromString();

            this.createMatrixDisplay({
                cellWidth: FieldLedMatrix.CELL_WIDTH,
                cellHeight: FieldLedMatrix.CELL_WIDTH,
                cellLabel: lf("LED"),
                cellHorizontalMargin: FieldLedMatrix.CELL_HORIZONTAL_MARGIN,
                cellVerticalMargin: FieldLedMatrix.CELL_VERTICAL_MARGIN,
                cornerRadius: FieldLedMatrix.CELL_CORNER_RADIUS,
                cellFill: this.offColor,
                padLeft: this.getYAxisWidth(),
                scale: this.scale
            });

            this.updateValue();

            if (this.xAxisLabel !== LabelMode.None) {
                const y = this.scale * this.numMatrixRows * (FieldLedMatrix.CELL_WIDTH + FieldLedMatrix.CELL_VERTICAL_MARGIN) + FieldLedMatrix.CELL_VERTICAL_MARGIN * 2 + FieldLedMatrix.BOTTOM_MARGIN
                const xAxis = pxsim.svg.child(this.matrixSvg, "g", { transform: `translate(${0} ${y})` });
                for (let i = 0; i < this.numMatrixCols; i++) {
                    const x = this.getYAxisWidth() + this.scale * i * (FieldLedMatrix.CELL_WIDTH + FieldLedMatrix.CELL_HORIZONTAL_MARGIN) + FieldLedMatrix.CELL_WIDTH / 2 + FieldLedMatrix.CELL_HORIZONTAL_MARGIN / 2;
                    const lbl = pxsim.svg.child(xAxis, "text", { x, class: "blocklyText" })
                    lbl.textContent = this.getLabel(i, this.xAxisLabel);
                }
            }

            if (this.yAxisLabel !== LabelMode.None) {
                const yAxis = pxsim.svg.child(this.matrixSvg, "g", {});
                for (let i = 0; i < this.numMatrixRows; i++) {
                    const y = this.scale * i * (FieldLedMatrix.CELL_WIDTH + FieldLedMatrix.CELL_VERTICAL_MARGIN) + FieldLedMatrix.CELL_WIDTH / 2 + FieldLedMatrix.CELL_VERTICAL_MARGIN * 2;
                    const lbl = pxsim.svg.child(yAxis, "text", { x: 0, y, class: "blocklyText" })
                    lbl.textContent = this.getLabel(i, this.yAxisLabel);
                }
            }

            this.fieldGroup_.classList.add("blocklyFieldLedMatrixGroup");
            this.fieldGroup_.replaceChild(this.matrixSvg, this.fieldGroup_.firstChild);

            this.attachEventHandlersToMatrix();
        }
    }

    private getLabel(index: number, mode: LabelMode) {
        switch (mode) {
            case LabelMode.Letter:
                return String.fromCharCode(index + /*char code for A*/ 65);
            default:
                return (index + 1).toString();
        }
    }

    private dontHandleMouseEvent_ = (ev: MouseEvent) => {
        ev.stopPropagation();
        ev.preventDefault();
    }

    private clearLedDragHandler = (ev: MouseEvent) => {
        const svgRoot = (this.sourceBlock_ as Blockly.BlockSvg).getSvgRoot();
        pxsim.pointerEvents.down.forEach(evid => svgRoot.removeEventListener(evid, this.dontHandleMouseEvent_));
        svgRoot.removeEventListener(pxsim.pointerEvents.move, this.dontHandleMouseEvent_);
        document.removeEventListener(pxsim.pointerEvents.up, this.clearLedDragHandler);
        document.removeEventListener(pxsim.pointerEvents.leave, this.clearLedDragHandler);

        (Blockly as any).Touch.clearTouchIdentifier();

        this.matrixSvg.removeEventListener(pxsim.pointerEvents.move, this.handleRootMouseMoveListener);

        ev.stopPropagation();
        ev.preventDefault();
    }

    public updateEditable() {
        let group = this.fieldGroup_;
        if (!this.EDITABLE || !group) {
            return;
        }

        if (this.sourceBlock_.isEditable()) {
            this.fieldGroup_.setAttribute("cursor", "pointer");
        } else {
            this.fieldGroup_.removeAttribute("cursor");
        }

        super.updateEditable();
    }

    protected attachPointerEventHandlersToCell(x: number, y: number, cellRect: SVGElement) {
        pxsim.pointerEvents.down.forEach(evid => cellRect.addEventListener(evid, (ev: MouseEvent) => {
            if (!this.sourceBlock_.isEditable()) return;

            const svgRoot = (this.sourceBlock_ as Blockly.BlockSvg).getSvgRoot();
            this.currentDragState_ = !this.cellState[x][y];

            // select and hide chaff
            Blockly.hideChaff();
            Blockly.common.setSelected(this.sourceBlock_ as Blockly.BlockSvg);

            this.toggleCell(x, y);
            pxsim.pointerEvents.down.forEach(evid => svgRoot.addEventListener(evid, this.dontHandleMouseEvent_));
            svgRoot.addEventListener(pxsim.pointerEvents.move, this.dontHandleMouseEvent_);

            document.addEventListener(pxsim.pointerEvents.up, this.clearLedDragHandler);
            document.addEventListener(pxsim.pointerEvents.leave, this.clearLedDragHandler);

            // Begin listening on the canvas and toggle any matches
            this.matrixSvg.addEventListener(pxsim.pointerEvents.move, this.handleRootMouseMoveListener);

            ev.stopPropagation();
            ev.preventDefault();
            this.returnEphemeralFocus();
        }, false));
    }

    protected toggleCell = (x: number, y: number, value?: boolean) => {
        this.cellState[x][y] = value ?? this.currentDragState_;
        this.updateValue();
    }

    private handleRootMouseMoveListener = (ev: MouseEvent) => {
        if (!this.sourceBlock_.isEditable()) return;

        let clientX;
        let clientY;
        if ((ev as any).changedTouches && (ev as any).changedTouches.length == 1) {
            // Handle touch events
            clientX = (ev as any).changedTouches[0].clientX;
            clientY = (ev as any).changedTouches[0].clientY;
        } else {
            // All other events (pointer + mouse)
            clientX = ev.clientX;
            clientY = ev.clientY;
        }
        const target = document.elementFromPoint(clientX, clientY);
        if (!target) return;
        const x = target.getAttribute('data-x');
        const y = target.getAttribute('data-y');
        if (x != null && y != null) {
            this.toggleCell(parseInt(x), parseInt(y));
        }
    }

    private getColor(x: number, y: number) {
        return this.cellState[x][y] ? this.onColor : (this.offColor || FieldLedMatrix.DEFAULT_OFF_COLOR);
    }

    private getOpacity(x: number, y: number) {
        const offOpacity = this.offColor ? '1.0': '0.2';
        return this.cellState[x][y] ? '1.0' : offOpacity;
    }

    private updateCell(x: number, y: number) {
        const cellRect = this.cells[x][y];
        cellRect.setAttribute("fill", this.getColor(x, y));
        cellRect.setAttribute("fill-opacity", this.getOpacity(x, y));
        cellRect.setAttribute('class', `blocklyLed${this.cellState[x][y] ? 'On' : 'Off'}`);
        cellRect.setAttribute("aria-checked", this.cellState[x][y].toString());
    }

    setValue(newValue: string | number, restoreState = true) {
        super.setValue(String(newValue));
        if (this.matrixSvg) {
            if (restoreState) this.restoreStateFromString();

            for (let x = 0; x < this.numMatrixCols; x++) {
                for (let y = 0; y < this.numMatrixRows; y++) {
                    this.updateCell(x, y);
                }
            }
        }
    }

    render_() {
        if (!this.visible_) {
            this.markDirty();
            return;
        }

        if (!this.matrixSvg) {
            this.initMatrix();
        }

        // The height and width must be set by the render function
        this.size_.height = this.scale * Number(this.numMatrixRows) * (FieldLedMatrix.CELL_WIDTH + FieldLedMatrix.CELL_VERTICAL_MARGIN) + FieldLedMatrix.CELL_VERTICAL_MARGIN * 2 + FieldLedMatrix.BOTTOM_MARGIN + this.getXAxisHeight()
        this.size_.width = this.scale * Number(this.numMatrixCols) * (FieldLedMatrix.CELL_WIDTH + FieldLedMatrix.CELL_HORIZONTAL_MARGIN) + FieldLedMatrix.CELL_HORIZONTAL_MARGIN + this.getYAxisWidth();
    }

    // The return value of this function is inserted in the code
    getValue() {
        // getText() returns the value that is set by calls to setValue()
        let text = removeQuotes(this.value_);
        return `\`\n${FieldLedMatrix.TAB}${text}\n${FieldLedMatrix.TAB}\``;
    }

    getFieldDescription(): string {
        return lf("{0}x{1} LED Grid", this.numMatrixCols, this.numMatrixRows);
    }

    // Restores the block state from the text value of the field
    private restoreStateFromString() {
        let r = this.value_ as string;
        if (r) {
            const rows = r.split("\n").filter(r => rowRegex.test(r));

            for (let y = 0; y < rows.length && y < this.numMatrixRows; y++) {
                let x = 0;
                const row = rows[y];

                for (let j = 0; j < row.length && x < this.numMatrixCols; j++) {
                    if (isNegativeCharacter(row[j])) {
                        this.cellState[x][y] = false;
                        x++;
                    }
                    else if (isPositiveCharacter(row[j])) {
                        this.cellState[x][y] = true;
                        x++;
                    }
                }
            }
        }
    }

    // Composes the state into a string an updates the field's state
    private updateValue() {
        let res = "";
        for (let y = 0; y < this.numMatrixRows; y++) {
            for (let x = 0; x < this.numMatrixCols; x++) {
                res += (this.cellState[x][y] ? "#" : ".") + " "
            }
            res += "\n" + FieldLedMatrix.TAB
        }

        // Blockly stores the state of the field as a string
        this.setValue(res, false);
    }

    private getYAxisWidth() {
        return this.yAxisLabel === LabelMode.None ? 0 : FieldLedMatrix.Y_AXIS_WIDTH;
    }

    private getXAxisHeight() {
        return this.xAxisLabel === LabelMode.None ? 0 : FieldLedMatrix.X_AXIS_HEIGHT;
    }
}

function isPositiveCharacter(c: string) {
    return c === "#" || c === "*" || c === "1";
}

function isNegativeCharacter(c: string) {
    return c === "." || c === "_" || c === "0";
}


const allQuotes = ["'", '"', "`"];

function removeQuotes(str: string) {
    str = (str || "").trim();
    const start = str.charAt(0);
    if (start === str.charAt(str.length - 1) && allQuotes.indexOf(start) !== -1) {
        return str.substr(1, str.length - 2).trim();
    }
    return str;
}

Blockly.Css.register(`
.blocklyFieldLedMatrixGroup.blocklyActiveFocus {
    outline: var(--blockly-selection-width) solid var(--blockly-active-node-color);
    border-radius: 3px;
}`);