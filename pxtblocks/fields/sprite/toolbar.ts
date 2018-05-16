/// <reference path="./tools.ts" />

namespace pxtblockly {
    import svg = pxt.svgUtil;
    import lf = pxt.Util.lf;

    export interface ToolbarProps {
        width: number;
        height: number;
        buttonMargin: number;
        optionsMargin: number;
        rowMargin: number;
    }

    export interface ToolbarHost {
        setActiveTool(tool: PaintTool): void;
        setToolWidth(width: number): void;
        undo(): void;
        redo(): void;
        resize(width: number, height: number): void;

        canvasWidth(): number;
        canvasHeight(): number;
    }

    export interface ToolOption {
        title: string;
        icon: string;
        tool: PaintTool;
    }

    export interface ToolbarTool extends ToolOption {
        options?: ToolOption[];
    }

    // The ratio of the toolbar height that is taken up by the options (as opposed to the buttons)
    const TOOLBAR_OPTIONS_RATIO = 0.333333;

    export class Toolbar {
        // Index of the selected tool (e.g. shapes)
        protected activeButtonIndex = 0;

        // Index of the selected option for a tool (e.g. shapes > circle)
        protected activeOptionIndex = 0;

        protected activeCursorSizeIndex = 0;
        protected selectedSizePreset = 2;

        protected optionBar: svg.Group;
        protected toolsBar: svg.Group;
        protected dropdownOptions: svg.Group;

        protected tools: ToolbarTool[];
        protected toolButtons: FontIconButton[];
        protected optionButtons: FontIconButton[];

        protected undoButton: FontIconButton;
        protected redoButton: FontIconButton;
        protected resizeButton: FontIconButton;

        protected cursorSizes: CursorSizeButton[];

        protected toolbarHeight: number;
        protected optionsHeight: number;

        protected sizePresets: [number, number][];

        constructor(protected g: svg.Group, protected props: ToolbarProps, protected host: ToolbarHost) {
            this.toolsBar = g.group();
            this.optionBar = g.group();
            this.dropdownOptions = this.optionBar.group();

            this.initTools();
            this.initControls();
            this.createOptionsBar();

            this.setSizePresets([
                [8, 8],
                [8, 16],
                [16, 16],
                [16, 32],
                [32, 32],
            ]);

            this.layout();
        }

        outerWidth() {
            return this.props.width;
        }

        outerHeight() {
            return this.props.height;
        }

        translate(x: number, y: number) {
            this.g.translate(x, y);
        }

        setDimensions(width: number, height: number) {
            if (this.props.width != width || this.props.height != height) {
                this.props.width = width;
                this.props.height = height;
                this.layout();
            }
        }

        resetTool() {
            this.setTool(0, false);
        }

        setUndoState(enabled: boolean) {
            this.undoButton.setEnabled(enabled);
        }

        setRedoState(enabled: boolean) {
            this.redoButton.setEnabled(enabled);
        }

        setSizePresets(presets: [number, number][]) {
            this.sizePresets = presets;

            if (this.sizePresets && this.sizePresets.length) {
                const canvasColumns = this.host.canvasWidth();
                const canvasRows = this.host.canvasHeight();

                this.sizePresets.forEach(([columns, rows], index) => {
                    if (columns === canvasColumns && rows === canvasRows) {
                        this.selectedSizePreset = index;
                    }
                });

                this.resizeButton.setVisible(true);
            }
            else {
                this.resizeButton.setVisible(false);
            }
        }

        protected initTools() {
            this.tools = [
                { title: lf("Pencil"), tool: PaintTool.Normal, icon: "\uf040" },
                { title: lf("Erase"), tool: PaintTool.Erase, icon: "\uf12d" },
                { title: lf("Fill"), tool: PaintTool.Fill, icon: "\uf0d0" },
                {
                    title: lf("Shapes"),
                    tool: PaintTool.Rectangle,
                    icon: "\uf096",
                    options: [
                        { title: lf("Rectangle"), tool: PaintTool.Rectangle, icon: "\uf096" },
                        { title: lf("Line"), tool: PaintTool.Line, icon: "\uf07e" },
                        { title: lf("Circle"), tool: PaintTool.Circle, icon: "\uf10c" },
                    ]
                },
            ];

            this.toolButtons = this.tools.map((tool, index) => {
                const toolBtn = this.addButton(tool.icon);
                toolBtn.title(tool.title);
                toolBtn.onClick(() => {
                    if (index === this.activeButtonIndex) return;
                    this.setTool(index);

                    if (tool.options && tool.options.length) {
                        this.showOptions(tool.options);
                    }
                    else {
                        this.clearOptions();
                    }
                });
                return toolBtn;
            });

            this.setTool(0);
        }

        protected initControls() {
            this.undoButton = this.addButton("\uf0e2");
            this.undoButton.title(lf("Undo"));
            this.undoButton.onClick(() => {
                this.host.undo();
            });

            this.redoButton = this.addButton("\uf01e");
            this.redoButton.title(lf("Redo"));
            this.redoButton.onClick(() => {
                this.host.redo();
            });

            this.resizeButton = this.addButton("\uf0b2");
            this.resizeButton.title(lf("Change sprite size"))
            this.resizeButton.onClick(() => {
                this.selectedSizePreset = (this.selectedSizePreset + 1) % this.sizePresets.length;
                const [width, height] = this.sizePresets[this.selectedSizePreset];
                this.host.resize(width, height);
            });
        }

        protected createOptionsBar() {
            this.cursorSizes = []
            for (let i = 0; i < 3; i++) {
                const btn = mkCursorSizeButton(i + 1, this.props.height);
                btn.title(sizeAdjective(i));
                this.cursorSizes.push(btn);
                this.optionBar.appendChild(btn.getView());
                btn.onClick(() => {
                    this.setToolWidth(i);
                });
            }
            this.setToolWidth(0);
        }

        protected addButton(icon: string) {
            const btn = mkToolbarButton(icon, this.props.height, 4);
            this.toolsBar.appendChild(btn.getView());

            return btn;
        }

        protected layout() {
            this.optionsHeight = TOOLBAR_OPTIONS_RATIO * this.props.height;
            this.toolbarHeight = this.props.height - this.optionsHeight - this.props.rowMargin;

            this.toolButtons.forEach((tButton, i) => this.layoutButton(tButton, i, true));

            this.layoutButton(this.undoButton, 2, false);
            this.layoutButton(this.redoButton, 1, false);
            this.layoutButton(this.resizeButton, 0, false);

            this.optionBar.translate(0, this.toolbarHeight + this.props.rowMargin);
            this.cursorSizes.forEach((button, i) => {
                button.setDimensions(this.optionsHeight, this.optionsHeight);
                button.translate(i * (this.optionsHeight + this.props.optionsMargin), 0);
            });

            this.layoutDropdown();
        }

        protected layoutButton(button: FontIconButton, index: number, fromLeft: boolean) {
            button.setDimensions(this.toolbarHeight, this.toolbarHeight);
            if (fromLeft) {
                button.translate(index * (this.toolbarHeight + this.props.buttonMargin), 0);
            }
            else {
                button.translate(this.props.width - (index + 1) * (this.toolbarHeight + this.props.buttonMargin), 0);
            }
        }

        protected layoutDropdown() {
            if (!this.optionButtons) return;

            const dropdownStart = this.toolButtons[this.activeButtonIndex].getView().left;
            this.dropdownOptions.translate(dropdownStart, 0);
            this.optionButtons.forEach((button, i) => {
                button.translate(i * (this.optionsHeight + this.props.optionsMargin), 0);
            });
        }

        protected setTool(index: number, isOption = false) {
            if (!isOption) {
                this.highlightTool(this.activeButtonIndex, false);
                this.activeButtonIndex = index;
                this.highlightTool(this.activeButtonIndex, true);
                this.host.setActiveTool(this.tools[index].tool);
            }
            else {
                this.highlightOption(this.activeOptionIndex, false);
                this.activeOptionIndex = index;
                this.highlightOption(this.activeOptionIndex, true);
                this.host.setActiveTool(this.tools[this.activeButtonIndex].options[index].tool);
            }
        }

        protected setToolWidth(index: number) {
            this.highlightCursorSize(this.activeCursorSizeIndex, false);
            this.activeCursorSizeIndex = index;
            this.highlightCursorSize(this.activeCursorSizeIndex, true);
            this.host.setToolWidth(1 + 2 * index);
        }

        protected highlightCursorSize(index: number, highlighted: boolean) {
            this.highlight(this.cursorSizes[index], "toolbar-button-selected", highlighted);
        }

        protected highlightTool(index: number, highlighted: boolean) {
            this.highlight(this.toolButtons[index], "toolbar-button-selected", highlighted);
        }

        protected highlightOption(index: number, highlighted: boolean) {
            if (this.optionButtons) {
                this.highlight(this.optionButtons[index], "toolbar-option-selected", highlighted);
            }
        }

        protected highlight(button: Button, cssClass: string, highlighted: boolean) {
            if (button) {
                if (highlighted) {
                    button.addClass(cssClass)
                }
                else {
                    button.removeClass(cssClass)
                }
            }
        }

        protected showOptions(options: ToolOption[]) {
            this.clearOptions();
            this.optionButtons = options.map((option, index) => {
                const button = mkToolbarButton(option.icon, this.optionsHeight, 2);
                button.title(option.title);
                button.onClick(() => {
                    this.setTool(index, true);
                });
                this.dropdownOptions.appendChild(button.getView());
                return button;
            });

            this.layoutDropdown();
            this.setTool(0, true);
        }

        protected clearOptions() {
            pxsim.U.clear(this.dropdownOptions.el);
            this.optionButtons = undefined;
        }
    }

    function mkCursorSizeButton(size: number, sideLength: number) {
        return new CursorSizeButton({
            width: sideLength,
            height: sideLength,
            padding: 2,
            cornerRadius: 2,
            rootClass: "toolbar-button",
            backgroundClass: "toolbar-button-background",
            cursorFill: "black",
            cursorSideLength: size
        });
    }

    function mkToolbarButton(icon: string, sideLength: number, padding: number) {
        return new FontIconButton({
            width: sideLength,
            height: sideLength,
            cornerRadius: 2,
            padding: padding,
            iconFont: "Icons",
            iconString: icon,
            rootClass: "toolbar-button",
            backgroundClass: "toolbar-button-background",
            iconClass: "toolbar-button-icon"
        });
    }

    function sizeAdjective(cursorIndex: number) {
        switch (cursorIndex) {
            case 0: return lf("Small Cursor");
            case 1: return lf("Medium Cursor");
            case 2: return lf("Large Cursor");
        }

        return undefined;
    }
}