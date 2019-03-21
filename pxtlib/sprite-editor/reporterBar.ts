/// <reference path="./buttons.ts" />
namespace pxtsprite {
    import svg = pxt.svgUtil;

    const UNDO_REDO_WIDTH = 65;
    const SIZE_BUTTON_WIDTH = 65;
    const SIZE_CURSOR_MARGIN = 10;

    export interface ReporterHost extends UndoRedoHost {
        resize(width: number, height: number): void;
        closeEditor(): void;
    }

    export class ReporterBar {
        root: svg.Group;
        cursorText: svg.Text;

        sizeButton: TextButton;
        doneButton: StandaloneTextButton;
        undoRedo: UndoRedoGroup;

        protected sizePresets: [number, number][];
        protected sizeIndex: number;

        constructor(parent: svg.Group, protected host: ReporterHost, protected height: number) {
            this.root = parent.group().id("sprite-editor-reporter-bar");
            this.undoRedo = new UndoRedoGroup(this.root, host, UNDO_REDO_WIDTH, height);

            this.sizeButton = mkTextButton("16x16", SIZE_BUTTON_WIDTH, height);
            this.sizeButton.onClick(() => {
                this.nextSize();
            });

            this.root.appendChild(this.sizeButton.getElement());

            this.doneButton = new StandaloneTextButton(lf("Done"), height);
            this.doneButton.addClass("sprite-editor-confirm-button");
            this.doneButton.onClick(() => this.host.closeEditor());

            this.root.appendChild(this.doneButton.getElement());

            this.sizePresets = [
                [16, 16]
            ];

            this.cursorText = this.root.draw("text")
                .appendClass("sprite-editor-text")
                .appendClass("sprite-editor-label")
                .setAttribute("dominant-baseline", "middle")
                .setAttribute("dy", 2.5);
        }

        updateDimensions(width: number, height: number) {
            this.sizeButton.setText(`${width}x${height}`);
        }

        hideCursor() {
            this.cursorText.text("");
        }

        updateCursor(col: number, row: number) {
            this.cursorText.text(`${col},${row}`);
        }

        updateUndoRedo(undo: boolean, redo: boolean) {
            this.undoRedo.updateState(undo, redo);
        }

        layout(top: number, left: number, width: number) {
            this.root.translate(left, top);

            this.doneButton.layout();

            const doneWidth = this.doneButton.width();

            this.undoRedo.translate(width - UNDO_REDO_WIDTH - SIZE_CURSOR_MARGIN - doneWidth, 0);
            this.doneButton.getElement().translate(width - doneWidth, 0);
            this.cursorText.moveTo(SIZE_BUTTON_WIDTH + SIZE_CURSOR_MARGIN, this.height / 2);
        }

        setSizePresets(presets: [number, number][], currentWidth: number, currentHeight: number) {
            this.sizePresets = presets;
            this.sizeIndex = undefined;
            for (let i = 0; i < presets.length; i++) {
                const [w, h] = presets[i];
                if (w === currentWidth && h === currentHeight) {
                    this.sizeIndex = i;
                    break;
                }
            }

            this.updateDimensions(currentWidth, currentHeight);
        }

        protected nextSize() {
            if (this.sizeIndex == undefined) {
                this.sizeIndex = 0;
            }
            else {
                this.sizeIndex = (this.sizeIndex + 1) % this.sizePresets.length;
            }

            const [w, h] = this.sizePresets[this.sizeIndex];
            this.host.resize(w, h);
        }
    }
}