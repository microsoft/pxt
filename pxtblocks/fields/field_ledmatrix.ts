/// <reference path="../../built/pxtlib.d.ts" />
/// <reference path="../../built/pxtsim.d.ts" />

import * as Blockly from "blockly";
import { FieldCustom } from "./field_utils";

const rowRegex = /^.*[\.#].*$/;

enum LabelMode {
    None,
    Number,
    Letter
}

export class FieldMatrix extends Blockly.Field implements FieldCustom {
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
    // The number of columns
    private matrixWidth: number = 5;

    // The number of rows
    private matrixHeight: number = 5;

    private yAxisLabel: LabelMode = LabelMode.None;
    private xAxisLabel: LabelMode = LabelMode.None;

    private cellState: boolean[][] = [];
    private cells: SVGRectElement[][] = [];
    private elt: SVGSVGElement;

    private currentDragState_: boolean;
    private selected: number[] | undefined = undefined;

    constructor(text: string, params: any, validator?: Blockly.FieldValidator) {
        super(text, validator);
        this.params = params;

        if (this.params.rows !== undefined) {
            let val = parseInt(this.params.rows);
            if (!isNaN(val)) {
                this.matrixHeight = val;
            }
        }

        if (this.params.columns !== undefined) {
            let val = parseInt(this.params.columns);
            if (!isNaN(val)) {
                this.matrixWidth = val;
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
        else if (Math.max(this.matrixWidth, this.matrixHeight) > 15)
            this.scale = 0.85;
        else if (Math.max(this.matrixWidth, this.matrixHeight) > 10)
            this.scale = 0.9;
    }

    private keyHandler(e: KeyboardEvent) {
        if (!this.selected) {
            return
        }
        const [x, y] = this.selected;
        const ctrlCmd = pxt.BrowserUtils.isMac() ? e.metaKey : e.ctrlKey;
        switch(e.code) {
            case "KeyW":
            case "ArrowUp": {
                if (y !== 0) {
                    this.selected = [x, y - 1]
                }
                break;
            }
            case "KeyS":
            case "ArrowDown": {
                if (y !== this.cells[0].length - 1) {
                    this.selected = [x, y + 1]
                }
                break;
            }
            case "KeyA":
            case "ArrowLeft": {
                if (x !== 0) {
                    this.selected = [x - 1, y]
                } else if (y !== 0){
                    this.selected = [this.matrixWidth - 1, y - 1]
                }
                break;
            }
            case "KeyD":
            case "ArrowRight": {
                if (x !== this.cells.length - 1) {
                    this.selected = [x + 1, y]
                } else if (y !== this.matrixHeight - 1) {
                    this.selected = [0, y + 1]
                }
                break;
            }
            case "Home": {
                if (ctrlCmd) {
                    this.selected = [0, 0]
                } else {
                    this.selected = [0, y]
                }
                break;
            }
            case "End": {
                if (ctrlCmd) {
                    this.selected = [this.matrixWidth - 1, this.matrixHeight - 1]
                } else {
                    this.selected = [this.matrixWidth - 1, y]
                }
                break;
            }
            case "Enter":
            case "Space": {
                this.toggleRect(x, y, !this.cellState[x][y]);
                break;
            }
            case "Escape": {
                (this.sourceBlock_.workspace as Blockly.WorkspaceSvg).markFocused();
                return;
            }
            default: {
                return
            }
        }
        const [newX, newY] = this.selected;
        this.setFocusIndicator(this.cells[newX][newY], this.cellState[newX][newY]);
        this.elt.setAttribute('aria-activedescendant', `${this.sourceBlock_.id}:${newX}${newY}`);
        e.preventDefault();
        e.stopPropagation();
    }

    private clearSelection() {
        if (this.selected) {
            this.setFocusIndicator();
            this.selected = undefined;
        }
        this.elt.removeAttribute('aria-activedescendant');
    }

    private removeKeyboardFocusHandlers() {
        this.elt.removeEventListener("keydown", this.keyHandler)
        this.elt.removeEventListener("blur", this.blurHandler)
    }

    private blurHandler() {
        this.removeKeyboardFocusHandlers();
        this.clearSelection();
    }

    private setFocusIndicator(cell?: SVGRectElement, ledOn?: boolean) {
        this.cells.forEach(cell => cell.forEach(cell => cell.nextElementSibling.firstElementChild.classList.remove("selectedLedOn", "selectedLedOff")));
        if (cell) {
            const className = ledOn ? "selectedLedOn" : "selectedLedOff"
            cell.nextElementSibling.firstElementChild.classList.add(className);
        }
    }

    /**
     * Show the inline free-text editor on top of the text.
     * @private
     */
    showEditor_() {
        this.selected = [0, 0];
        this.setFocusIndicator(this.cells[0][0], this.cellState[0][0])
        this.elt.setAttribute('aria-activedescendant', this.sourceBlock_.id + ":00");
        this.elt.focus();
    }

    private initMatrix() {
        if (!this.sourceBlock_.isInsertionMarker()) {
            this.elt = pxsim.svg.parseString(`<svg xmlns="http://www.w3.org/2000/svg" id="field-matrix" class="blocklyMatrix" tabindex="-1" role="grid" aria-label="${lf("LED grid")}" />`);

            // Initialize the matrix that holds the state
            for (let i = 0; i < this.matrixWidth; i++) {
                this.cellState.push([])
                this.cells.push([]);
                for (let j = 0; j < this.matrixHeight; j++) {
                    this.cellState[i].push(false);
                }
            }

            this.restoreStateFromString();

            // Create the cells of the matrix that is displayed
            for (let y = 0; y < this.matrixHeight; y++) {
                const row = this.createRow()
                for (let x = 0; x < this.matrixWidth; x++) {
                    this.createCell(x, y, row);
                }
            }

            this.updateValue();

            if (this.xAxisLabel !== LabelMode.None) {
                const y = this.scale * this.matrixHeight * (FieldMatrix.CELL_WIDTH + FieldMatrix.CELL_VERTICAL_MARGIN) + FieldMatrix.CELL_VERTICAL_MARGIN * 2 + FieldMatrix.BOTTOM_MARGIN
                const xAxis = pxsim.svg.child(this.elt, "g", { transform: `translate(${0} ${y})` });
                for (let i = 0; i < this.matrixWidth; i++) {
                    const x = this.getYAxisWidth() + this.scale * i * (FieldMatrix.CELL_WIDTH + FieldMatrix.CELL_HORIZONTAL_MARGIN) + FieldMatrix.CELL_WIDTH / 2 + FieldMatrix.CELL_HORIZONTAL_MARGIN / 2;
                    const lbl = pxsim.svg.child(xAxis, "text", { x, class: "blocklyText" })
                    lbl.textContent = this.getLabel(i, this.xAxisLabel);
                }
            }

            if (this.yAxisLabel !== LabelMode.None) {
                const yAxis = pxsim.svg.child(this.elt, "g", {});
                for (let i = 0; i < this.matrixHeight; i++) {
                    const y = this.scale * i * (FieldMatrix.CELL_WIDTH + FieldMatrix.CELL_VERTICAL_MARGIN) + FieldMatrix.CELL_WIDTH / 2 + FieldMatrix.CELL_VERTICAL_MARGIN * 2;
                    const lbl = pxsim.svg.child(yAxis, "text", { x: 0, y, class: "blocklyText" })
                    lbl.textContent = this.getLabel(i, this.yAxisLabel);
                }
            }

            this.fieldGroup_.replaceChild(this.elt, this.fieldGroup_.firstChild);
            if (!this.sourceBlock_.isInFlyout) {
                this.elt.addEventListener("keydown", this.keyHandler.bind(this));
                this.elt.addEventListener("blur", this.blurHandler.bind(this));
            }
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

        this.elt.removeEventListener(pxsim.pointerEvents.move, this.handleRootMouseMoveListener);

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

    private createRow() {
        return pxsim.svg.child(this.elt, "g", { 'role': 'row' });
    }

    private createCell(x: number, y: number, row: SVGElement) {
        const tx = this.scale * x * (FieldMatrix.CELL_WIDTH + FieldMatrix.CELL_HORIZONTAL_MARGIN) + FieldMatrix.CELL_HORIZONTAL_MARGIN + this.getYAxisWidth();
        const ty = this.scale * y * (FieldMatrix.CELL_WIDTH + FieldMatrix.CELL_VERTICAL_MARGIN) + FieldMatrix.CELL_VERTICAL_MARGIN;

        const cellG = pxsim.svg.child(row, "g", { transform: `translate(${tx} ${ty})`, 'role': 'gridcell' });
        const cellRect = pxsim.svg.child(cellG, "rect", {
            'id': `${this.sourceBlock_.id}:${x}${y}`, // For aria-activedescendant
            'class': `blocklyLed${this.cellState[x][y] ? 'On' : 'Off'}`,
            'aria-label': lf("LED"),
            'role': 'switch',
            'aria-checked': this.cellState[x][y].toString(),
            width: this.scale * FieldMatrix.CELL_WIDTH, height: this.scale * FieldMatrix.CELL_WIDTH,
            fill: this.getColor(x, y),
            'data-x': x,
            'data-y': y,
            rx: Math.max(2, this.scale * FieldMatrix.CELL_CORNER_RADIUS) }) as SVGRectElement;
        this.cells[x][y] = cellRect;

        // Borders and box-shadow do not work in this context and outlines do not follow border-radius.
        // Stroke is harder to manage given the difference in stroke for an LED when it is on vs off.
        // This foreignObject/div is used to create a focus indicator for the LED when selected via keyboard navigation.
        const foreignObject = pxsim.svg.child(cellG, "foreignObject", {
            transform: 'translate(-4, -4)',
            width: this.scale * FieldMatrix.CELL_WIDTH + 8,
            height: this.scale * FieldMatrix.CELL_WIDTH + 8,
        });
        foreignObject.style.pointerEvents = "none";
        const div = document.createElement("div");
        div.classList.add("blocklyLedFocusIndicator");
        div.style.borderRadius = `${Math.max(2, this.scale * FieldMatrix.CELL_CORNER_RADIUS)}px`;
        foreignObject.append(div);

        if ((this.sourceBlock_.workspace as any).isFlyout) return;

        pxsim.pointerEvents.down.forEach(evid => cellRect.addEventListener(evid, (ev: MouseEvent) => {
            if (!this.sourceBlock_.isEditable()) return;

            const svgRoot = (this.sourceBlock_ as Blockly.BlockSvg).getSvgRoot();
            this.currentDragState_ = !this.cellState[x][y];

            // select and hide chaff
            Blockly.hideChaff();
            Blockly.common.setSelected(this.sourceBlock_ as Blockly.BlockSvg);

            this.toggleRect(x, y);
            pxsim.pointerEvents.down.forEach(evid => svgRoot.addEventListener(evid, this.dontHandleMouseEvent_));
            svgRoot.addEventListener(pxsim.pointerEvents.move, this.dontHandleMouseEvent_);

            document.addEventListener(pxsim.pointerEvents.up, this.clearLedDragHandler);
            document.addEventListener(pxsim.pointerEvents.leave, this.clearLedDragHandler);

            // Begin listening on the canvas and toggle any matches
            this.elt.addEventListener(pxsim.pointerEvents.move, this.handleRootMouseMoveListener);

            ev.stopPropagation();
            ev.preventDefault();
            // Clear event listeners and selection used for keyboard navigation.
            this.removeKeyboardFocusHandlers();
            this.clearSelection();
            // This enables keyboard navigation in the Blockly workspace if not focused already.
            (this.sourceBlock_.workspace as Blockly.WorkspaceSvg).markFocused();
        }, false));
    }

    private toggleRect = (x: number, y: number, value?: boolean) => {
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
            this.toggleRect(parseInt(x), parseInt(y));
        }
    }

    private getColor(x: number, y: number) {
        return this.cellState[x][y] ? this.onColor : (this.offColor || FieldMatrix.DEFAULT_OFF_COLOR);
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
        if (this.elt) {
            if (restoreState) this.restoreStateFromString();

            for (let x = 0; x < this.matrixWidth; x++) {
                for (let y = 0; y < this.matrixHeight; y++) {
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

        if (!this.elt) {
            this.initMatrix();
        }

        // The height and width must be set by the render function
        this.size_.height = this.scale * Number(this.matrixHeight) * (FieldMatrix.CELL_WIDTH + FieldMatrix.CELL_VERTICAL_MARGIN) + FieldMatrix.CELL_VERTICAL_MARGIN * 2 + FieldMatrix.BOTTOM_MARGIN + this.getXAxisHeight()
        this.size_.width = this.scale * Number(this.matrixWidth) * (FieldMatrix.CELL_WIDTH + FieldMatrix.CELL_HORIZONTAL_MARGIN) + FieldMatrix.CELL_HORIZONTAL_MARGIN + this.getYAxisWidth();
    }

    // The return value of this function is inserted in the code
    getValue() {
        // getText() returns the value that is set by calls to setValue()
        let text = removeQuotes(this.value_);
        return `\`\n${FieldMatrix.TAB}${text}\n${FieldMatrix.TAB}\``;
    }

    getFieldDescription(): string {
        return lf("{0}x{1} LED Grid", this.matrixWidth, this.matrixHeight);
    }

    // Restores the block state from the text value of the field
    private restoreStateFromString() {
        let r = this.value_ as string;
        if (r) {
            const rows = r.split("\n").filter(r => rowRegex.test(r));

            for (let y = 0; y < rows.length && y < this.matrixHeight; y++) {
                let x = 0;
                const row = rows[y];

                for (let j = 0; j < row.length && x < this.matrixWidth; j++) {
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
        for (let y = 0; y < this.matrixHeight; y++) {
            for (let x = 0; x < this.matrixWidth; x++) {
                res += (this.cellState[x][y] ? "#" : ".") + " "
            }
            res += "\n" + FieldMatrix.TAB
        }

        // Blockly stores the state of the field as a string
        this.setValue(res, false);
    }

    private getYAxisWidth() {
        return this.yAxisLabel === LabelMode.None ? 0 : FieldMatrix.Y_AXIS_WIDTH;
    }

    private getXAxisHeight() {
        return this.xAxisLabel === LabelMode.None ? 0 : FieldMatrix.X_AXIS_HEIGHT;
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
.blocklyMatrix:focus-visible {
    outline: none;
}

.blocklyMatrix .blocklyLedFocusIndicator {
    border: 4px solid transparent;
    height: 100%;
}

.blocklyMatrix .blocklyLedFocusIndicator.selectedLedOn,
.blocklyMatrix .blocklyLedFocusIndicator.selectedLedOff {
    border-color: white;
    transform: translateZ(0);
}

.blocklyMatrix .blocklyLedFocusIndicator.selectedLedOn:after {
    content: "";
    position: absolute;
    top: -2px;
    left: -2px;
    right: -2px;
    bottom: -2px;
    border: 2px solid black;
    border-radius: inherit;
}
`)