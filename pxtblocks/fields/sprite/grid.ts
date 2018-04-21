/// <reference path="./util.ts" />


namespace pxtblockly {
    import svg = pxt.svgUtil;

    export interface GridStyleProps {
        cellWidth: number;
        cellHeight: number;
        columnMargin: number;
        outerMargin: number;
        rowMargin: number;
        cornerRadius: number;
        defaultColor: string;
        cellIdPrefix: string;
        backgroundFill?: string;
        cellClass?: string;
    }

    export interface GridProps extends GridStyleProps {
        rowLength: number;
        numCells: number;
    }

    /**
     * An SVG grid of pixels
     */
    export class Grid {
        protected group: svg.Group;
        protected cellGroup: svg.Group;
        protected cells: svg.Rect[];
        protected dragSurface: svg.Rect;
        protected background: svg.Rect;
        protected point: SVGPoint;

        protected gridProps: GridProps;
        protected rows: number;
        protected columns: number;

        private gesture: GestureState;

        constructor(props: Partial<GridProps>, protected root?: svg.SVG) {
            this.gridProps = mergeProps(defaultGridProps(), props);
            this.updateDimensions();
            this.group = new svg.Group();
            this.buildDom();
        }

        outerWidth(): number {
            const x = this.cellToCoord(this.columns - 1, 0)[0];
            return x + this.gridProps.cellWidth + this.gridProps.outerMargin;
        }

        outerHeight(): number {
            const y = this.cellToCoord(0, this.rows - 1)[1];
            return y + this.gridProps.cellHeight + this.gridProps.outerMargin;
        }

        getView() {
            return this.group;
        }

        translate(x: number, y: number) {
            this.group.translate(x, y);
        }

        scale(ratio: number) {
            this.group.scale(ratio);
        }

        resizeGrid(rowLength: number, numCells: number) {
            this.gridProps.rowLength = rowLength;
            this.gridProps.numCells = numCells;
            this.updateDimensions();

            if (numCells > this.cells.length) {
                while (this.cells.length < numCells) {
                    this.cells.push(this.buildCell());
                }
            }
            else if (numCells < this.cells.length) {
                while (this.cells.length > numCells) {
                    const c = this.cells.pop();
                    this.cellGroup.el.removeChild(c.el);
                }
            }

            this.layout();
        }

        setCellDimensions(width: number, height = width) {
            this.gridProps.cellWidth = width;
            this.gridProps.cellHeight = height;
            this.layout();
        }

        setGridDimensions(width: number, height = width, lockAspectRatio = true) {
            const totalCellWidth = this.columns * this.gridProps.cellWidth;
            const totalCellHeight = this.rows * this.gridProps.cellHeight;

            const targetWidth = width - (this.outerWidth() - totalCellWidth);
            const targetHeight = height - (this.outerHeight() - totalCellHeight);

            const maxCellWidth = this.gridProps.cellWidth * (targetWidth / totalCellWidth);
            const maxCellHeight = this.gridProps.cellHeight * (targetHeight / totalCellHeight);

            if (lockAspectRatio) {
                const aspectRatio = this.gridProps.cellWidth / this.gridProps.cellHeight;

                if (aspectRatio >= 1) {
                    const w = Math.min(maxCellWidth, maxCellHeight * aspectRatio);
                    this.setCellDimensions(w, w * aspectRatio);
                }
                else {
                    const h = Math.min(maxCellHeight, maxCellWidth / aspectRatio)
                    this.setCellDimensions(h / aspectRatio, h);
                }
            }
            else {
                this.setCellDimensions(maxCellWidth, maxCellHeight);
            }
        }

        setCellColor(column: number, row: number, color: string, opacity?: number): void {
            if (column < 0 || row < 0 || column >= this.columns || row >= this.rows) {
                return;
            }
            column = Math.floor(column);
            row = Math.floor(row);

            const cell = this.getCell(this.cellToIndex(column, row))
            if (color != null) {
                cell.setVisible(true);
                cell.fill(color, opacity);
            }
            else {
                cell.setVisible(false);
            }
        }

        setRootId(id: string) {
            this.group.id(id);
        }

        down(handler: (col: number, row: number) => void): void {
            this.initDragSurface();
            this.gesture.subscribe(GestureType.Down, handler);
        }

        up(handler: (col: number, row: number) => void): void {
            this.initDragSurface();
            this.gesture.subscribe(GestureType.Up, handler);
        }

        drag(handler: (col: number, row: number) => void): void {
            this.initDragSurface();
            this.gesture.subscribe(GestureType.Drag, handler);
        }

        move(handler: (col: number, row: number) => void): void {
            this.initDragSurface();
            this.gesture.subscribe(GestureType.Move, handler);
        }

        leave(handler: () => void): void {
            this.initDragSurface();
            this.gesture.subscribe(GestureType.Leave, handler);
        }

        protected cellToCoord(column: number, row: number): Coord {
            const x = this.gridProps.outerMargin + column * (this.gridProps.cellWidth + this.gridProps.columnMargin);
            const y = this.gridProps.outerMargin + row * (this.gridProps.cellHeight + this.gridProps.rowMargin);
            return [x, y];
        }

        protected coordToCell(x: number, y: number): Coord {
            const column = Math.floor((x - this.gridProps.outerMargin) / (this.gridProps.cellWidth + this.gridProps.columnMargin));
            const row = Math.floor((y - this.gridProps.outerMargin) / (this.gridProps.cellHeight + this.gridProps.rowMargin));
            return [column, row];
        }

        protected indexToCell(index: number): Coord {
            const col = index % this.gridProps.rowLength;
            const row = Math.floor(index / this.gridProps.rowLength);
            return [col, row];
        }

        protected cellToIndex(col: number, row: number): number {
            return row * this.gridProps.rowLength + col;
        }

        protected clientToCell(clientX: number, clientY: number) {
            if (!this.point) this.point = this.root.el.createSVGPoint();
            this.point.x = clientX;
            this.point.y = clientY;
            const cursor = this.point.matrixTransform(this.root.el.getScreenCTM().inverse());
            return this.coordToCell(cursor.x - this.group.left, cursor.y - this.group.top);
        }

        protected buildDom() {
            this.cells = [];
            if (this.gridProps.backgroundFill) {
                this.background = this.group.draw("rect")
                    .size(this.outerWidth(), this.outerHeight())
                    .fill(this.gridProps.backgroundFill);
            }
            this.cellGroup = this.group.group();
            let count = 0;
            for (let col = 0; col < this.columns; col++) {
                for (let row = 0; row < this.rows; row++) {
                    this.cells.push(this.buildCell());
                    count++;
                    if (count > this.gridProps.numCells) {
                        return;
                    }
                }
            }
            this.layout();
        }

        protected buildCell(): svg.Rect {
            const cell = this.cellGroup.draw("rect")
                .size(this.gridProps.cellWidth, this.gridProps.cellHeight)
                .fill(this.gridProps.defaultColor)

            if (this.gridProps.cornerRadius) {
                cell.corner(this.gridProps.cornerRadius)
            }

            if (this.gridProps.cellClass) {
                cell.setAttribute("class", this.gridProps.cellClass);
            }

            return cell;
        }

        protected layout() {
            // Position grid cells
            for (let c = 0; c < this.columns; c++) {
                for (let r = 0; r < this.rows; r++) {
                    const [x, y] = this.cellToCoord(c, r);
                    const index = this.cellToIndex(c, r);
                    this.getCell(index)
                        .at(x, y)
                        .size(this.gridProps.cellWidth, this.gridProps.cellHeight)
                        .id(this.gridProps.cellIdPrefix + "-" + index)
                        .attr({ "data-grid-index": index });
                }
            }

            // Resize gesture surface and background
            if (this.dragSurface) {
                this.dragSurface.size(this.outerWidth(), this.outerHeight());
            }

            if (this.background) {
                this.background.size(this.outerWidth(), this.outerHeight());
            }
        }

        protected getCell(index: number): svg.Rect {
            return this.cells[index];
        }

        private initDragSurface() {
            if (!this.dragSurface && this.root) {
                this.gesture = new GestureState();
                this.dragSurface = this.group.draw("rect")
                    .opacity(0)
                    .width(this.outerWidth())
                    .height(this.outerHeight());

                this.dragSurface.el.addEventListener("pointermove", (ev: MouseEvent) => {
                    const [col, row] = this.clientToCell(ev.clientX, ev.clientY);
                    if (ev.buttons & 1) {
                        this.gesture.handle(InputEvent.Down, col, row);
                    }
                    this.gesture.handle(InputEvent.Move, col, row);
                });

                this.dragSurface.el.addEventListener("pointerdown", (ev: MouseEvent) => {
                    const [col, row] = this.clientToCell(ev.clientX, ev.clientY);
                    this.gesture.handle(InputEvent.Down, col, row);
                });

                this.dragSurface.el.addEventListener("pointerup", (ev: MouseEvent) => {
                    const [col, row] = this.clientToCell(ev.clientX, ev.clientY);
                    this.gesture.handle(InputEvent.Up, col, row);
                });

                this.dragSurface.el.addEventListener("pointerclick", (ev: MouseEvent) => {
                    const [col, row] = this.clientToCell(ev.clientX, ev.clientY);
                    this.gesture.handle(InputEvent.Down, col, row);
                    this.gesture.handle(InputEvent.Up, col, row);
                });

                this.dragSurface.el.addEventListener("pointerleave", ev => {
                    const [col, row] = this.clientToCell(ev.clientX, ev.clientY);
                    this.gesture.handle(InputEvent.Leave, col, row);
                });
            }
        }

        private updateDimensions() {
            this.columns = this.gridProps.rowLength;
            this.rows = Math.ceil(this.gridProps.numCells / this.columns);
        }
    }

    enum InputEvent {
        Up,
        Down,
        Move,
        Leave
    }

    enum GestureType {
        Up,
        Down,
        Move,
        Drag,
        Leave
    }

    type GestureHandler = (col: number, row: number) => void;

    class GestureState {
        lastCol: number;
        lastRow: number;

        isDown = false;

        handlers: {[index: number]: GestureHandler} = {};

        handle(event: InputEvent, col: number, row: number) {
            switch (event) {
                case InputEvent.Up:
                    this.update(col, row);
                    this.isDown = false;
                    this.fire(GestureType.Up);
                    break;
                case InputEvent.Down:
                    if (!this.isDown) {
                        this.isDown = true;
                        this.fire(GestureType.Down);
                    }
                    break;
                case InputEvent.Move:
                    if (col === this.lastCol && row === this.lastRow) return;
                    this.update(col, row);
                    if (this.isDown) {
                        this.fire(GestureType.Drag);
                    }
                    else {
                        this.fire(GestureType.Move);
                    }
                    break;

                case InputEvent.Leave:
                    this.update(col, row);
                    this.isDown = false;
                    this.fire(GestureType.Leave);
                    break;
            }
        }

        subscribe(type: GestureType, handler: GestureHandler) {
            this.handlers[type] = handler;
        }

        protected update(col: number, row: number) {
            this.lastCol = col;
            this.lastRow = row;
        }

        protected fire(type: GestureType) {
            if (this.handlers[type]) {
                this.handlers[type](this.lastCol, this.lastRow);
            }
        }
    }

    export function defaultGridProps(): GridProps {
        return {
            rowLength: 16,
            numCells: 16 * 16,
            cellWidth: 10,
            cellHeight: 10,
            outerMargin: 0,
            columnMargin: 0,
            rowMargin: 0,
            cornerRadius: 0,
            defaultColor: "#ffffff",
            cellIdPrefix: uniquePrefix()
        };
    }

    let current = 0;
    export function uniquePrefix() {
        return "grid" + current++;
    }
}