namespace pxsim.visuals {
    export const BOARD_SYTLE = `
        .noselect {
            -webkit-touch-callout: none; /* iOS Safari */
            -webkit-user-select: none;   /* Chrome/Safari/Opera */
            -khtml-user-select: none;    /* Konqueror */
            -moz-user-select: none;      /* Firefox */
            -ms-user-select: none;       /* Internet Explorer/Microsoft Edge */
            user-select: none;           /* Non-prefixed version, currently
                                            not supported by any browser */
        }

        .sim-board-pin {
            fill:#999;
            stroke:#000;
            stroke-width:${PIN_DIST / 3.0}px;
        }
        .sim-board-pin-lbl {
            fill: #333;
        }
        .gray-cover {
            fill:#FFF;
            opacity: 0.3;
            stroke-width:0;
            visibility: hidden;
        }
        .sim-board-pin-hover {
            visibility: hidden;
            pointer-events: all;
            stroke-width:${PIN_DIST / 6.0}px;
        }
        .sim-board-pin-hover:hover {
            visibility: visible;
        }
        .sim-board-pin-lbl {
            visibility: hidden;
        }
        .sim-board-outline .sim-board-pin-lbl {
            visibility: visible;
        }
        .sim-board-pin-lbl {
            fill: #555;
        }
        .sim-board-pin-lbl-hover {
            fill: red;
        }
        .sim-board-outline .sim-board-pin-lbl-hover {
            fill: black;
        }
        .sim-board-pin-lbl,
        .sim-board-pin-lbl-hover {
            font-family:"Lucida Console", Monaco, monospace;
            pointer-events: all;
            stroke-width: 0;
        }
        .sim-board-pin-lbl-hover {
            visibility: hidden;
        }
        .sim-board-outline .sim-board-pin-hover:hover + .sim-board-pin-lbl,
        .sim-board-pin-lbl.highlight {
            visibility: hidden;
        }
        .sim-board-outline .sim-board-pin-hover:hover + * + .sim-board-pin-lbl-hover,
        .sim-board-pin-lbl-hover.highlight {
            visibility: visible;
        }
        /* Graying out */
        .grayed .sim-board-pin-lbl:not(.highlight) {
            fill: #AAA;
        }
        .grayed .sim-board-pin:not(.highlight) {
            fill:#BBB;
            stroke:#777;
        }
        .grayed .gray-cover {
            visibility: inherit;
        }
        .grayed .sim-cmp:not(.notgrayed) {
            opacity: 0.3;
        }
        /* Highlighting */
        .sim-board-pin-lbl.highlight {
            fill: #000;
            font-weight: bold;
        }
        .sim-board-pin.highlight {
            fill:#999;
            stroke:#000;
        }
        `;
    const PIN_LBL_SIZE = PIN_DIST * 0.7;
    const PIN_LBL_HOVER_SIZE = PIN_LBL_SIZE * 1.5;
    const SQUARE_PIN_WIDTH = PIN_DIST * 0.66666;
    const SQUARE_PIN_HOVER_WIDTH = PIN_DIST * 0.66666 + PIN_DIST / 3.0;

    export interface GenericBoardProps {
        visualDef: BoardImageDefinition;
        boardDef: BoardDefinition;
        wireframe?: boolean;
    }

    let nextBoardId = 0;
    export class GenericBoardSvg implements BoardView {
        private element: SVGSVGElement;
        private style: SVGStyleElement;
        private defs: SVGDefsElement;
        private g: SVGGElement;
        private background: SVGElement;
        private width: number;
        private height: number;
        private id: number;

        // pins & labels
        //(truth)
        private allPins: GridPin[] = [];
        private allLabels: GridLabel[] = [];
        //(cache)
        private pinNmToLbl: Map<GridLabel> = {};
        private pinNmToPin: Map<GridPin> = {};

        constructor(public props: GenericBoardProps) {
            //TODO: handle wireframe mode
            this.id = nextBoardId++;
            let visDef = props.visualDef;
            let imgHref = props.wireframe && visDef.outlineImage ? visDef.outlineImage : visDef.image;
            let boardImgAndSize = mkImageSVG({
                image: imgHref,
                width: visDef.width,
                height: visDef.height,
                imageUnitDist: visDef.pinDist,
                targetUnitDist: PIN_DIST
            });
            let scaleFn = mkScaleFn(visDef.pinDist, PIN_DIST);
            this.width = boardImgAndSize.w;
            this.height = boardImgAndSize.h;
            let img = boardImgAndSize.el;
            this.element = <SVGSVGElement>svg.elt("svg");
            svg.hydrate(this.element, {
                "version": "1.0",
                "viewBox": `0 0 ${this.width} ${this.height}`,
                "class": `sim sim-board-id-${this.id}`,
                "x": "0px",
                "y": "0px"
            });
            if (props.wireframe)
                svg.addClass(this.element, "sim-board-outline")
            this.style = <SVGStyleElement>svg.child(this.element, "style", {});
            this.style.textContent += BOARD_SYTLE;
            this.defs = <SVGDefsElement>svg.child(this.element, "defs", {});
            this.g = <SVGGElement>svg.elt("g");
            this.element.appendChild(this.g);

            // main board
            this.g.appendChild(img);
            this.background = img;
            svg.hydrate(img, { class: "sim-board" });
            // does not look great
            //let backgroundCover = this.mkGrayCover(0, 0, this.width, this.height);
            //this.g.appendChild(backgroundCover);

            // ----- pins
            const mkRoundPin = (): SVGElAndSize => {
                let el = svg.elt("circle");
                let width = SQUARE_PIN_WIDTH;
                svg.hydrate(el, {
                    class: "sim-board-pin",
                    r: width / 2,
                });
                return { el: el, w: width, h: width, x: 0, y: 0 };
            }
            const mkRoundHoverPin = (): SVGElAndSize => {
                let el = svg.elt("circle");
                let width = SQUARE_PIN_HOVER_WIDTH;
                svg.hydrate(el, {
                    class: "sim-board-pin-hover",
                    r: width / 2
                });
                return { el: el, w: width, h: width, x: 0, y: 0 };
            }

            const mkSquarePin = (): SVGElAndSize => {
                let el = svg.elt("rect");
                let width = SQUARE_PIN_WIDTH;
                svg.hydrate(el, {
                    class: "sim-board-pin",
                    width: width,
                    height: width,
                });
                return { el: el, w: width, h: width, x: 0, y: 0 };
            }
            const mkSquareHoverPin = (): SVGElAndSize => {
                let el = svg.elt("rect");
                let width = SQUARE_PIN_HOVER_WIDTH;
                svg.hydrate(el, {
                    class: "sim-board-pin-hover",
                    width: width,
                    height: width
                });
                return { el: el, w: width, h: width, x: 0, y: 0 };
            }
            const mkPinBlockGrid = (pinBlock: PinBlockDefinition, blockIdx: number) => {
                let xOffset = scaleFn(pinBlock.x) + PIN_DIST / 2.0;
                let yOffset = scaleFn(pinBlock.y) + PIN_DIST / 2.0;
                let rowCount = 1;
                let colCount = pinBlock.labels.length;
                let getColName = (colIdx: number) => pinBlock.labels[colIdx];
                let getRowName = () => `${blockIdx + 1}`
                let getGroupName = () => pinBlock.labels.join(" ");
                let gridRes = mkGrid({
                    xOffset: xOffset,
                    yOffset: yOffset,
                    rowCount: rowCount,
                    colCount: colCount,
                    pinDist: PIN_DIST,
                    mkPin: visDef.useCrocClips ? mkRoundPin : mkSquarePin,
                    mkHoverPin: visDef.useCrocClips ? mkRoundHoverPin : mkSquareHoverPin,
                    getRowName: getRowName,
                    getColName: getColName,
                    getGroupName: getGroupName,
                });
                let pins = gridRes.allPins;
                let pinsG = gridRes.g;
                svg.addClass(gridRes.g, "sim-board-pin-group");
                return gridRes;
            };
            let pinBlocks = visDef.pinBlocks.map(mkPinBlockGrid);
            let pinToBlockDef: PinBlockDefinition[] = [];
            pinBlocks.forEach((blk, blkIdx) => blk.allPins.forEach((p, pIdx) => {
                this.allPins.push(p);
                pinToBlockDef.push(visDef.pinBlocks[blkIdx]);
            }));
            //tooltip
            this.allPins.forEach(p => {
                let tooltip = p.col;
                svg.hydrate(p.el, { title: tooltip });
                svg.hydrate(p.hoverEl, { title: tooltip });
            });
            //catalog pins
            this.allPins.forEach(p => {
                this.pinNmToPin[p.col] = p;
            });

            // ----- labels
            const mkLabelTxtEl = (pinX: number, pinY: number, size: number, txt: string, pos: "above" | "below"): SVGTextElement => {
                //TODO: extract constants
                let lblY: number;
                let lblX: number;

                if (pos === "below") {
                    let lblLen = size * 0.25 * txt.length;
                    lblX = pinX;
                    lblY = pinY + 12 + lblLen;
                } else {
                    let lblLen = size * 0.32 * txt.length;
                    lblX = pinX;
                    lblY = pinY - 11 - lblLen;
                }
                let el = mkTxt(lblX, lblY, size, -90, txt);
                return el;
            };
            const mkLabel = (pinX: number, pinY: number, txt: string, pos: "above" | "below"): GridLabel => {
                let el = mkLabelTxtEl(pinX, pinY, PIN_LBL_SIZE, txt, pos);
                svg.addClass(el, "sim-board-pin-lbl");
                let hoverEl = mkLabelTxtEl(pinX, pinY, PIN_LBL_HOVER_SIZE, txt, pos);
                svg.addClass(hoverEl, "sim-board-pin-lbl-hover");
                let label: GridLabel = { el: el, hoverEl: hoverEl, txt: txt };
                return label;
            }
            this.allLabels = this.allPins.map((p, pIdx) => {
                let blk = pinToBlockDef[pIdx];
                return mkLabel(p.cx, p.cy, p.col, blk.labelPosition || "above");
            });
            //catalog labels
            this.allPins.forEach((pin, pinIdx) => {
                let lbl = this.allLabels[pinIdx];
                this.pinNmToLbl[pin.col] = lbl;
            });

            //attach pins & labels
            this.allPins.forEach((p, idx) => {
                let lbl = this.allLabels[idx];
                //pins and labels must be adjacent for hover CSS
                this.g.appendChild(p.el);
                this.g.appendChild(p.hoverEl);
                this.g.appendChild(lbl.el);
                this.g.appendChild(lbl.hoverEl);
            });
        }

        private findPin(pinNm: string): GridPin {
            let pin = this.pinNmToPin[pinNm];
            if (!pin && this.props.boardDef.gpioPinMap) {
                pinNm = this.props.boardDef.gpioPinMap[pinNm];
                if (pinNm)
                    pin = this.pinNmToPin[pinNm];
            }
            return pin;
        }

        private findPinLabel(pinNm: string): GridLabel {
            let pin = this.pinNmToLbl[pinNm];
            if (!pin && this.props.boardDef.gpioPinMap) {
                pinNm = this.props.boardDef.gpioPinMap[pinNm];
                if (pinNm)
                    pin = this.pinNmToLbl[pinNm];
            }
            return pin;
        }

        public getCoord(pinNm: string): Coord {
            let pin = this.findPin(pinNm);
            if (!pin)
                return null;
            return [pin.cx, pin.cy];
        }

        private mkGrayCover(x: number, y: number, w: number, h: number) {
            let rect = <SVGRectElement>svg.elt("rect");
            svg.hydrate(rect, { x: x, y: y, width: w, height: h, class: "gray-cover" });
            return rect;
        }


        public getView(): SVGAndSize<SVGSVGElement> {
            return { el: this.element, w: this.width, h: this.height, x: 0, y: 0 };
        }

        public getPinDist() {
            return PIN_DIST;
        }

        public highlightPin(pinNm: string) {
            let lbl = this.findPinLabel(pinNm);
            let pin = this.findPin(pinNm);
            if (lbl && pin) {
                svg.addClass(lbl.el, "highlight");
                svg.addClass(lbl.hoverEl, "highlight");
                svg.addClass(pin.el, "highlight");
                svg.addClass(pin.hoverEl, "highlight");
            }
        }
    }
}