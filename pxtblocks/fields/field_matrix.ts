import * as Blockly from "blockly";

interface MatrixDisplayProps {
    cellWidth: number;
    cellHeight: number;
    cellLabel: string;
    cellHorizontalMargin: number;
    cellVerticalMargin: number;
    cornerRadius: number;
    cellStroke?: string;
    cellFill?: string;
    padLeft?: number;
    scale?: number;
}

export abstract class FieldMatrix extends Blockly.Field {
    protected cells: SVGRectElement[][] = [];
    protected matrixSvg: SVGSVGElement;
    private keyDownBinding: Blockly.browserEvents.Data | null = null;
    private blurBinding: Blockly.browserEvents.Data | null = null;
    protected selected: [x: number, y: number] | undefined = undefined;

    protected abstract numMatrixCols: number;
    protected abstract numMatrixRows: number;
    protected abstract clearSelectionOnBlur: boolean;
    protected returnEphemeralFocusFn: Blockly.ReturnEphemeralFocus | undefined = undefined;

    protected createMatrixDisplay({
        cellWidth,
        cellHeight,
        cellLabel,
        cellHorizontalMargin,
        cellVerticalMargin,
        cornerRadius = 0,
        cellFill,
        cellStroke,
        padLeft = 0,
        scale = 1
    }: MatrixDisplayProps): void {
        // Initialize the matrix that holds the state
        for (let i = 0; i < this.numMatrixCols; i++) {
            this.cells.push([]);
        }

        // Create the cells of the matrix that is displayed
        for (let y = 0; y < this.numMatrixRows; y++) {
            const row = pxsim.svg.child(this.matrixSvg, "g", { 'role': 'row' });
            for (let x = 0; x < this.numMatrixCols; x++) {
                const tx = scale * x * (cellWidth + cellHorizontalMargin) + cellHorizontalMargin + padLeft;
                const ty = scale * y * (cellHeight + cellVerticalMargin) + cellVerticalMargin;

                const cellG = pxsim.svg.child(row, "g", { transform: `translate(${tx} ${ty})`, 'role': 'gridcell' });
                const rectOptions = {
                    'id': this.getCellId(x,y),  // For aria-activedescendant
                    'aria-label': cellLabel,
                    'role': 'switch',
                    'aria-checked': "false",
                    'width': scale * cellWidth,
                    'height': scale * cellHeight,
                    'fill': cellFill ?? "none",
                    'stroke': cellStroke,
                    'data-x': x,
                    'data-y': y,
                    'rx': Math.max(2, scale * cornerRadius)
                };
                const cellRect = pxsim.svg.child(cellG, "rect", rectOptions) as SVGRectElement;
                this.cells[x][y] = cellRect;

                // Borders and box-shadow do not work in this context and outlines do not follow border-radius.
                // Stroke is harder to manage given the difference in stroke for a cell when it is toggled.
                // This foreignObject/div is used to create a focus indicator for the cell when selected via keyboard navigation.
                const foreignObject = pxsim.svg.child(cellG, "foreignObject", {
                    transform: 'translate(-4, -4)',
                    width: scale * cellWidth + 8,
                    height: scale * cellWidth + 8,
                });
                foreignObject.style.pointerEvents = "none";
                const div = document.createElement("div");
                div.classList.add("blocklyCellFocusIndicator");
                div.style.borderRadius = `${Math.max(2, scale * cornerRadius)}px`;
                foreignObject.append(div);
            }
        }
    }

    protected handleArrowUp(x: number, y: number) {
        this.selected = [x, y - 1]
    }

    protected handleArrowDown(x: number, y: number) {
        this.selected = [x, y + 1]
    }

    protected handleArrowLeft(x: number, y: number) {
        if (x !== 0) {
            this.selected = [x - 1, y]
        } else if (y !== 0){
            this.selected = [this.numMatrixCols - 1, y - 1]
        }
    }

    protected handleArrowRight(x: number, y: number) {
        if (x !== this.cells.length - 1) {
            this.selected = [x + 1, y]
        } else if (y !== this.numMatrixRows - 1) {
            this.selected = [0, y + 1]
        }
    }

    private addKeyDownHandler() {
        this.keyDownBinding = Blockly.browserEvents.bind(this.matrixSvg, 'keydown', this, (e: KeyboardEvent) => {
            if (!this.selected) {
                return
            }
            const [x, y] = this.selected;
            const ctrlCmd = pxt.BrowserUtils.isMac() ? e.metaKey : e.ctrlKey;
            switch(e.code) {
                case "ArrowUp": {
                    if (y !== 0) {
                        this.handleArrowUp(x, y);
                    }
                    break;
                }
                case "ArrowDown": {
                    if (y !== this.cells[0].length - 1) {
                        this.handleArrowDown(x, y)
                    }
                    break;
                }
                case "ArrowLeft": {
                    this.handleArrowLeft(x, y);
                    break;
                }
                case "ArrowRight": {
                    this.handleArrowRight(x, y)
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
                        this.selected = [this.numMatrixCols - 1, this.numMatrixRows - 1]
                    } else {
                        this.selected = [this.numMatrixCols - 1, y]
                    }
                    break;
                }
                case "Enter":
                case "Space": {
                    this.toggleCell(x, y, !this.getCellToggled(x, y));
                    break;
                }
                case "Escape": {
                    (this.sourceBlock_.workspace as Blockly.WorkspaceSvg).markFocused();
                    this.returnEphemeralFocus();
                    return;
                }
                default: {
                    return
                }
            }
            const [newX, newY] = this.selected;
            this.focusCell(newX, newY);
            e.preventDefault();
            e.stopPropagation();
        });
    }

    private addBlurHandler() {
        this.blurBinding = Blockly.browserEvents.bind(this.matrixSvg, 'blur', this, (_e: FocusEvent) => {
            if (this.clearSelectionOnBlur) {
                this.removeKeyboardFocusHandlers();
                this.clearCellSelection();
            } else {
                this.clearFocusIndicator();
            }
        });
    }

    protected focusCell(x: number, y: number) {
        this.setCellSelection(x, y);
        this.setFocusIndicator(this.cells[x][y], this.useTwoToneFocusIndicator(x, y));
    }

    private setCellSelection(x: number, y: number) {
        this.matrixSvg.setAttribute('aria-activedescendant', this.getCellId(x, y));
    }

    protected clearCellSelection() {
        if (this.selected) {
            this.clearFocusIndicator();
            this.selected = undefined;
        }
        this.matrixSvg.removeAttribute('aria-activedescendant');
    }

    private setFocusIndicator(cell: SVGRectElement, useTwoToneFocusIndicator: boolean) {
        this.clearFocusIndicator();
        const className = useTwoToneFocusIndicator ? "focusedTwoTone" : "focused"
        cell.nextElementSibling.firstElementChild.classList.add(className);
    }

    protected clearFocusIndicator() {
        this.cells.forEach(cell => cell.forEach(cell => cell.nextElementSibling.firstElementChild.classList.remove("focusedTwoTone", "focused")));
    }

    protected addKeyboardFocusHandlers() {
        if (this.sourceBlock_.isInFlyout) return;

        this.addKeyDownHandler();
        this.addBlurHandler();
    }

    protected attachEventHandlersToMatrix() {
        if (this.sourceBlock_.isInFlyout) return;

        for (let x = 0; x < this.numMatrixCols; ++x) {
            for (let y = 0; y < this.numMatrixRows; ++y) {
                this.attachPointerEventHandlersToCell(x, y, this.cells[x][y]);
            }
        }
    }

    protected returnEphemeralFocus() {
        if (this.returnEphemeralFocusFn) {
            this.returnEphemeralFocusFn();
            this.returnEphemeralFocusFn = undefined;
        }
    }

    protected removeKeyboardFocusHandlers() {
        if (this.keyDownBinding) {
            Blockly.browserEvents.unbind(this.keyDownBinding)
            this.keyDownBinding = undefined;
        }
        if (this.blurBinding) {
            Blockly.browserEvents.unbind(this.blurBinding)
            this.blurBinding = undefined;
        }
    }

    protected getCellId = (x: number, y: number) => `${this.sourceBlock_.id}:${x}-${y}`;

    protected abstract attachPointerEventHandlersToCell(x: number, y: number, cellRect: SVGElement): void;

    protected abstract useTwoToneFocusIndicator(x: number, y: number): boolean;

    protected abstract toggleCell(x: number, y: number, value?: boolean): void;

    protected abstract getCellToggled(x: number, y: number): boolean;
}

Blockly.Css.register(`
    .blocklyMatrix:focus-visible {
        outline: none;
    }

    .blocklyMatrix .blocklyCellFocusIndicator {
        border: 4px solid transparent;
        height: 100%;
    }

    .blocklyMatrix:focus-visible .blocklyCellFocusIndicator.focusedTwoTone,
    .blocklyMatrix:focus-visible .blocklyCellFocusIndicator.focused {
        border-color: white;
        transform: translateZ(0);
    }

    .blocklyMatrix:focus-visible .blocklyCellFocusIndicator.focusedTwoTone:after {
        content: "";
        position: absolute;
        top: -2px;
        left: -2px;
        right: -2px;
        bottom: -2px;
        border: 2px solid black;
        border-radius: inherit;
    }
`);
