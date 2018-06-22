/// <reference path="./grid.ts" />


namespace pxtblockly {
    import svg = pxt.svgUtil;
    import lf = pxt.Util.lf;

    export interface ColorPaletteProps extends GridStyleProps {
        colors: string[];
        rowLength: number;
        emptySwatchDisabled: boolean;
        emptySwatchFill: string;
        selectedClass: string;
        unselectedClass: string;
    }

    export class ColorPalette extends Grid {
        selected: number;
        private props: ColorPaletteProps;
        private handler: (color: number) => void;
        private selectedClone: svg.BaseElement<SVGUseElement>;

        constructor(props: Partial<ColorPaletteProps>) {
            super(toGridProps(mergeProps(defaultPaletteProps(), props)));

            this.props = mergeProps(defaultPaletteProps(), props);
            this.selected = 0;

            // SVG elements are drawn according to their order in the DOM. The selected color's
            // rect may grow in size (larger stroke width) so in order to prevent it from being
            // overlapped by other elements we can clone it at the end of the DOM with a "use"
            // element
            this.selectedClone = new svg.BaseElement("use");
            this.group.appendChild(this.selectedClone);

            this.initColors();
        }

        colorForIndex(index: number) {
            if (this.props.emptySwatchDisabled) {
                return this.props.colors[index];
            }
            else if (index === 0) {
                return this.props.emptySwatchFill;
            }
            else {
                return this.props.colors[index - 1];
            }
        }

        setSelected(index: number) {
            this.setCellHighlighted(this.selected, false);
            this.selected = index;
            this.setCellHighlighted(this.selected, true);

            if (this.handler) {
                this.handler(this.selected);
            }
        }

        selectedColor() {
            return this.colorForIndex(this.selected);
        }

        setCellHighlighted(index: number, highlighted: boolean)  {
            const cell = this.getCell(index);
            if (highlighted) {
                cell.removeClass(this.props.unselectedClass);
                cell.appendClass(this.props.selectedClass);
                this.selectedClone.setAttribute("href", cell.el.getAttribute("id"))
            }
            else {
                cell.removeClass(this.props.selectedClass);
                cell.appendClass(this.props.unselectedClass);
            }
        }

        onColorSelected(handler: (color: number) => void) {
            this.handler = handler;
        }

        protected initColors() {
            for (let i = 0; i < this.gridProps.numCells; i++) {
                const cell = this.getCell(i);
                if (i === 0) {
                    cell.title(lf("Color Index 0 (Transparent)"));
                }
                else {
                    cell.title(lf("Color Index {0}", i));
                }
                cell.fill(this.colorForIndex(i));
                cell.onDown(() => this.setSelected(i));
                this.setCellHighlighted(i, false);
            }
            this.setSelected(0);
        }
    }

    function defaultPaletteProps(): ColorPaletteProps {
        return {
            colors: ["red", "green", "blue"],
            rowLength: 4,
            emptySwatchDisabled: false,
            emptySwatchFill: "lightgrey",
            selectedClass: "palette-selected",
            unselectedClass: "palette-unselected",
            cellWidth: 10,
            cellHeight: 10,
            maxCellWidth: 32,
            maxCellHeight: 32,
            columnMargin: 1,
            rowMargin: 1,
            outerMargin: 1,
            cornerRadius: 0,
            defaultColor: "#ffffff",
            cellIdPrefix: uniquePrefix()
        };
    }

    function toGridProps(props: Partial<ColorPaletteProps>) {
        const res = mergeProps(defaultGridProps(), props);
        res.numCells = props.colors.length + (props.emptySwatchDisabled ? 0 : 1);
        if (res.numCells <= 8) res.rowLength = 1;
        return res;
    }
}