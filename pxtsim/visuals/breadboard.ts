namespace pxsim.visuals {
    // The distance between the center of two pins. This is the constant on which everything else is based.
    const PIN_DIST = 15;
    // CSS styling for the breadboard
    const BLUE = "#1AA5D7";
    const RED = "#DD4BA0";
    const BREADBOARD_CSS = `
        /* bread board */
        .sim-bb-background {
            fill:#E0E0E0;
        }
        .sim-bb-pin {
            fill:#999;
        }
        .sim-bb-pin-hover {
            visibility: hidden;
            pointer-events: all;
            stroke-width: ${PIN_DIST / 2}px;
            stroke: transparent;
            fill: #777;
        }
        .sim-bb-pin-hover:hover {
            visibility: visible;
            fill:#444;
        }
        .sim-bb-group-wire {
            stroke: #999;
            stroke-width: ${PIN_DIST / 4}px;
            visibility: hidden;
        }
        .sim-bb-pin-group {
            pointer-events: all;
        }
        .sim-bb-label,
        .sim-bb-label-hover {
            font-family:"Lucida Console", Monaco, monospace;
            fill:#555;
            pointer-events: all;
            stroke-width: 0;
            cursor: default;
        }
        .sim-bb-label-hover {
            visibility: hidden;
            fill:#000;
            font-weight: bold;
        }
        .sim-bb-bar {
            stroke-width: 0;
        }
        .sim-bb-blue {
            fill:${BLUE};
            stroke:${BLUE}
        }
        .sim-bb-red {
            fill:${RED};
            stroke:${RED};
        }
        .sim-bb-pin-group:hover .sim-bb-pin-hover,
        .sim-bb-pin-group:hover .sim-bb-group-wire,
        .sim-bb-pin-group:hover .sim-bb-label-hover {
            visibility: visible;
        }
        .sim-bb-pin-group:hover .sim-bb-label {
            visibility: hidden;
        }
        /* outline mode */
        .sim-bb-outline .sim-bb-background {
            stroke-width: ${PIN_DIST / 7}px;
            fill: #FFF;
            stroke: #000;
        }
        .sim-bb-outline .sim-bb-mid-channel {
            fill: #FFF;
            stroke: #888;
            stroke-width: 2px;
        }
        /* grayed out */
        .grayed .sim-bb-background {
            stroke-width: ${PIN_DIST / 5}px;
        }
        .grayed .sim-bb-red,
        .grayed .sim-bb-blue {
            fill: #BBB;
        }
        .grayed .sim-bb-bar {
            fill: #FFF;
        }
        .grayed .sim-bb-pin {
            fill: #000;
            stroke: #FFF;
            stroke-width: 3px;
        }
        .grayed .sim-bb-label {
            fill: none;
        }
        .grayed .sim-bb-background {
            stroke-width: ${PIN_DIST / 2}px;
            stroke: #555;
        }
        .grayed .sim-bb-group-wire {
            stroke: #DDD;
        }
        .grayed .sim-bb-channel {
            visibility: hidden;
        }
        /* highlighted */
        .sim-bb-label.highlight {
            visibility: hidden;
        }
        .sim-bb-label-hover.highlight {
            visibility: visible;
        }
        .sim-bb-blue.highlight {
            fill:${BLUE};
        }
        .sim-bb-red.highlight {
            fill:${RED};
        }
        .sim-bb-bar.highlight {
            stroke-width: 0px;
        }
        `
    // Pin rows and coluns
    export const BREADBOARD_MID_ROWS = 10;
    export const BREADBOARD_MID_COLS = 30;
    const MID_ROW_GAPS = [4, 4];
    const MID_ROW_AND_GAPS = BREADBOARD_MID_ROWS + MID_ROW_GAPS.length;
    const BAR_ROWS = 2;
    const BAR_COLS = 25;
    const POWER_ROWS = BAR_ROWS * 2;
    const POWER_COLS = BAR_COLS * 2;
    const BAR_COL_GAPS = [4, 9, 14, 19];
    const BAR_COL_AND_GAPS = BAR_COLS + BAR_COL_GAPS.length;
    // Essential dimensions
    const WIDTH = PIN_DIST * (BREADBOARD_MID_COLS + 3);
    const HEIGHT = PIN_DIST * (MID_ROW_AND_GAPS + POWER_ROWS + 5.5);
    const MID_RATIO = 2.0 / 3.0;
    const BAR_RATIO = (1.0 - MID_RATIO) * 0.5;
    const MID_HEIGHT = HEIGHT * MID_RATIO;
    const BAR_HEIGHT = HEIGHT * BAR_RATIO;
    // Pin grids
    const MID_GRID_WIDTH = (BREADBOARD_MID_COLS - 1) * PIN_DIST;
    const MID_GRID_HEIGHT = (MID_ROW_AND_GAPS - 1) * PIN_DIST;
    const MID_GRID_X = (WIDTH - MID_GRID_WIDTH) / 2.0;
    const MID_GRID_Y = BAR_HEIGHT + (MID_HEIGHT - MID_GRID_HEIGHT) / 2.0;
    const BAR_GRID_HEIGHT = (BAR_ROWS - 1) * PIN_DIST;
    const BAR_GRID_WIDTH = (BAR_COL_AND_GAPS - 1) * PIN_DIST;
    const BAR_TOP_GRID_X = (WIDTH - BAR_GRID_WIDTH) / 2.0;
    const BAR_TOP_GRID_Y = (BAR_HEIGHT - BAR_GRID_HEIGHT) / 2.0;
    const BAR_BOT_GRID_X = BAR_TOP_GRID_X;
    const BAR_BOT_GRID_Y = BAR_TOP_GRID_Y + BAR_HEIGHT + MID_HEIGHT;
    // Individual pins
    const PIN_HOVER_SCALAR = 1.3;
    const PIN_WIDTH = PIN_DIST / 2.5;
    const PIN_ROUNDING = PIN_DIST / 7.5;
    // Labels
    const PIN_LBL_SIZE = PIN_DIST * 0.7;
    const PIN_LBL_HOVER_SCALAR = 1.3;
    const PLUS_LBL_SIZE = PIN_DIST * 1.7;
    const MINUS_LBL_SIZE = PIN_DIST * 2;
    const POWER_LBL_OFFSET = PIN_DIST * 0.8;
    const MINUS_LBL_EXTRA_OFFSET = PIN_DIST * 0.07;
    const LBL_ROTATION = -90;
    // Channels
    const CHANNEL_HEIGHT = PIN_DIST * 1.0;
    const SMALL_CHANNEL_HEIGHT = PIN_DIST * 0.05;
    // Background
    const BACKGROUND_ROUNDING = PIN_DIST * 0.3;
    // Row and column helpers
    const alphabet = "abcdefghij".split("").reverse();
    export function getColumnName(colIdx: number): string { return `${colIdx + 1}` };
    export function getRowName(rowIdx: number): string { return alphabet[rowIdx] };

    export interface GridPin {
        el: SVGElement,
        hoverEl: SVGElement,
        cx: number,
        cy: number,
        row: string,
        col: string,
        group?: string
    };
    export interface GridOptions {
        xOffset?: number,
        yOffset?: number,
        rowCount: number,
        colCount: number,
        rowStartIdx?: number,
        colStartIdx?: number,
        pinDist: number,
        mkPin: () => SVGElAndSize,
        mkHoverPin: () => SVGElAndSize,
        getRowName: (rowIdx: number) => string,
        getColName: (colIdx: number) => string,
        getGroupName?: (rowIdx: number, colIdx: number) => string,
        rowIdxsWithGap?: number[],
        colIdxsWithGap?: number[],
    };
    export interface GridResult {
        g: SVGGElement,
        allPins: GridPin[],
    }
    export function mkGrid(opts: GridOptions): GridResult {
        let xOff = opts.xOffset || 0;
        let yOff = opts.yOffset || 0;
        let allPins: GridPin[] = [];
        let grid = <SVGGElement>svg.elt("g");
        let colIdxOffset = opts.colStartIdx || 0;
        let rowIdxOffset = opts.rowStartIdx || 0;
        let copyArr = <T>(arr: T[]): T[] => arr ? arr.slice(0, arr.length) : [];
        let removeAll = <T>(arr: T[], e: T): number => {
            let res = 0;
            let idx: number;
            /* tslint:disable:no-conditional-assignment */
            while (0 <= (idx = arr.indexOf(e))) {
                /* tslint:enable:no-conditional-assignment */
                arr.splice(idx, 1);
                res += 1;
            }
            return res;
        };
        let rowGaps = 0;
        let rowIdxsWithGap = copyArr(opts.rowIdxsWithGap)
        for (let i = 0; i < opts.rowCount; i++) {
            let colGaps = 0;
            let colIdxsWithGap = copyArr(opts.colIdxsWithGap)
            let cy = yOff + i * opts.pinDist + rowGaps * opts.pinDist;
            let rowIdx = i + rowIdxOffset;
            for (let j = 0; j < opts.colCount; j++) {
                let cx = xOff + j * opts.pinDist + colGaps * opts.pinDist;
                let colIdx = j + colIdxOffset;
                const addEl = (pin: SVGElAndSize) => {
                    svg.hydrate(pin.el, pin.el.tagName == "circle"
                        ? { cx, cy }
                        : { x: cx - pin.w * 0.5, y: cy - pin.h * 0.5 });
                    grid.appendChild(pin.el);
                    return pin.el;
                }
                let el = addEl(opts.mkPin());
                let hoverEl = addEl(opts.mkHoverPin());
                let row = opts.getRowName(rowIdx);
                let col = opts.getColName(colIdx);
                let group = opts.getGroupName ? opts.getGroupName(rowIdx, colIdx) : null;
                let gridPin: GridPin = { el: el, hoverEl: hoverEl, cx: cx, cy: cy, row: row, col: col, group: group };
                allPins.push(gridPin);
                //column gaps
                colGaps += removeAll(colIdxsWithGap, colIdx);
            }
            //row gaps
            rowGaps += removeAll(rowIdxsWithGap, rowIdx);
        }
        return { g: grid, allPins: allPins };
    }
    function mkBBPin(): SVGElAndSize {
        let el = svg.elt("rect");
        let width = PIN_WIDTH;
        svg.hydrate(el, {
            class: "sim-bb-pin",
            rx: PIN_ROUNDING,
            ry: PIN_ROUNDING,
            width: width,
            height: width
        });
        return { el: el, w: width, h: width, x: 0, y: 0 };
    }
    function mkBBHoverPin(): SVGElAndSize {
        let el = svg.elt("rect");
        let width = PIN_WIDTH * PIN_HOVER_SCALAR;
        svg.hydrate(el, {
            class: "sim-bb-pin-hover",
            rx: PIN_ROUNDING,
            ry: PIN_ROUNDING,
            width: width,
            height: width,
        });
        return { el: el, w: width, h: width, x: 0, y: 0 };
    }
    export interface GridLabel {
        el: SVGTextElement,
        hoverEl: SVGTextElement,
        txt: string,
        group?: string,
    };
    function mkBBLabel(cx: number, cy: number, size: number, rotation: number, txt: string, group: string, extraClasses?: string[]): GridLabel {
        //lbl
        let el = mkTxt(cx, cy, size, rotation, txt);
        svg.addClass(el, "sim-bb-label");
        if (extraClasses)
            extraClasses.forEach(c => svg.addClass(el, c));

        //hover lbl
        let hoverEl = mkTxt(cx, cy, size * PIN_LBL_HOVER_SCALAR, rotation, txt);
        svg.addClass(hoverEl, "sim-bb-label-hover");
        if (extraClasses)
            extraClasses.forEach(c => svg.addClass(hoverEl, c));

        let lbl = { el: el, hoverEl: hoverEl, txt: txt, group: group };
        return lbl;
    }
    interface BBBar {
        el: SVGRectElement,
        group?: string
    };

    export interface BreadboardOpts {
        wireframe?: boolean,
    }
    export class Breadboard {
        public bb: SVGSVGElement;
        private styleEl: SVGStyleElement;
        private defs: SVGDefsElement;

        //truth
        private allPins: GridPin[] = [];
        private allLabels: GridLabel[] = [];
        private allPowerBars: BBBar[] = [];
        //quick lookup caches
        private rowColToPin: Map<Map<GridPin>> = {};
        private rowColToLbls: Map<Map<GridLabel[]>> = {};

        constructor(opts: BreadboardOpts) {
            this.buildDom();

            if (opts.wireframe)
                svg.addClass(this.bb, "sim-bb-outline");
        }

        public hide() {
            this.bb.style.display = 'none';
        }

        public updateLocation(x: number, y: number) {
            svg.hydrate(this.bb, {
                x: `${x}px`,
                y: `${y}px`,
            });
        }

        public getPin(row: string, col: string): GridPin {
            let colToPin = this.rowColToPin[row];
            if (!colToPin)
                return null;
            let pin = colToPin[col];
            if (!pin)
                return null;
            return pin;
        }
        public getCoord(rowCol: BBLoc): Coord {
            let { row, col, xOffset, yOffset } = rowCol;
            let pin = this.getPin(row, col);
            if (!pin)
                return null;
            let xOff = (xOffset || 0) * PIN_DIST;
            let yOff = (yOffset || 0) * PIN_DIST;
            return [pin.cx + xOff, pin.cy + yOff];
        }

        public getPinDist() {
            return PIN_DIST;
        }

        private buildDom() {
            this.bb = <SVGSVGElement>svg.elt("svg", {
                "version": "1.0",
                "viewBox": `0 0 ${WIDTH} ${HEIGHT}`,
                "class": `sim-bb`,
                "width": WIDTH + "px",
                "height": HEIGHT + "px",
            });
            this.styleEl = <SVGStyleElement>svg.child(this.bb, "style", {});
            this.styleEl.textContent += BREADBOARD_CSS;
            this.defs = <SVGDefsElement>svg.child(this.bb, "defs", {});

            //background
            svg.child(this.bb, "rect", { class: "sim-bb-background", width: WIDTH, height: HEIGHT, rx: BACKGROUND_ROUNDING, ry: BACKGROUND_ROUNDING });

            //mid channel
            let channelGid = "sim-bb-channel-grad";
            let channelGrad = <SVGLinearGradientElement>svg.elt("linearGradient")
            svg.hydrate(channelGrad, { id: channelGid, x1: "0%", y1: "0%", x2: "0%", y2: "100%" });
            this.defs.appendChild(channelGrad);
            let channelDark = "#AAA";
            let channelLight = "#CCC";
            let stop1 = svg.child(channelGrad, "stop", { offset: "0%", style: `stop-color: ${channelDark};` })
            let stop2 = svg.child(channelGrad, "stop", { offset: "20%", style: `stop-color: ${channelLight};` })
            let stop3 = svg.child(channelGrad, "stop", { offset: "80%", style: `stop-color: ${channelLight};` })
            let stop4 = svg.child(channelGrad, "stop", { offset: "100%", style: `stop-color: ${channelDark};` })

            const mkChannel = (cy: number, h: number, cls?: string) => {
                let channel = svg.child(this.bb, "rect", { class: `sim-bb-channel ${cls || ""}`, y: cy - h / 2, width: WIDTH, height: h });
                channel.setAttribute("fill", `url(#${channelGid})`);
                return channel;
            }

            mkChannel(BAR_HEIGHT + MID_HEIGHT / 2, CHANNEL_HEIGHT, "sim-bb-mid-channel");
            mkChannel(BAR_HEIGHT, SMALL_CHANNEL_HEIGHT, "sim-bb-sml-channel");
            mkChannel(BAR_HEIGHT + MID_HEIGHT, SMALL_CHANNEL_HEIGHT, "sim-bb-sml-channel");

            //-----pins
            const getMidTopOrBot = (rowIdx: number) => rowIdx < BREADBOARD_MID_ROWS / 2.0 ? "b" : "t";
            const getBarTopOrBot = (colIdx: number) => colIdx < POWER_COLS / 2.0 ? "b" : "t";
            const getMidGroupName = (rowIdx: number, colIdx: number) => {
                let botOrTop = getMidTopOrBot(rowIdx);
                let colNm = getColumnName(colIdx);
                return `${botOrTop}${colNm}`;
            };
            const getBarRowName = (rowIdx: number) => rowIdx === 0 ? "-" : "+";
            const getBarGroupName = (rowIdx: number, colIdx: number) => {
                let botOrTop = getBarTopOrBot(colIdx);
                let rowName = getBarRowName(rowIdx);
                return `${rowName}${botOrTop}`;
            };

            //mid grid
            let midGridRes = mkGrid({
                xOffset: MID_GRID_X,
                yOffset: MID_GRID_Y,
                rowCount: BREADBOARD_MID_ROWS,
                colCount: BREADBOARD_MID_COLS,
                pinDist: PIN_DIST,
                mkPin: mkBBPin,
                mkHoverPin: mkBBHoverPin,
                getRowName: getRowName,
                getColName: getColumnName,
                getGroupName: getMidGroupName,
                rowIdxsWithGap: MID_ROW_GAPS,
            });
            let midGridG = midGridRes.g;
            this.allPins = this.allPins.concat(midGridRes.allPins);

            //bot bar
            let botBarGridRes = mkGrid({
                xOffset: BAR_BOT_GRID_X,
                yOffset: BAR_BOT_GRID_Y,
                rowCount: BAR_ROWS,
                colCount: BAR_COLS,
                pinDist: PIN_DIST,
                mkPin: mkBBPin,
                mkHoverPin: mkBBHoverPin,
                getRowName: getBarRowName,
                getColName: getColumnName,
                getGroupName: getBarGroupName,
                colIdxsWithGap: BAR_COL_GAPS,
            });
            let botBarGridG = botBarGridRes.g;
            this.allPins = this.allPins.concat(botBarGridRes.allPins);

            //top bar
            let topBarGridRes = mkGrid({
                xOffset: BAR_TOP_GRID_X,
                yOffset: BAR_TOP_GRID_Y,
                rowCount: BAR_ROWS,
                colCount: BAR_COLS,
                colStartIdx: BAR_COLS,
                pinDist: PIN_DIST,
                mkPin: mkBBPin,
                mkHoverPin: mkBBHoverPin,
                getRowName: getBarRowName,
                getColName: getColumnName,
                getGroupName: getBarGroupName,
                colIdxsWithGap: BAR_COL_GAPS.map(g => g + BAR_COLS),
            });
            let topBarGridG = topBarGridRes.g;
            this.allPins = this.allPins.concat(topBarGridRes.allPins);

            //tooltip
            this.allPins.forEach(pin => {
                let { el, row, col, hoverEl } = pin
                let title = `(${row},${col})`;
                svg.hydrate(el, { title: title });
                svg.hydrate(hoverEl, { title: title });
            })

            //catalog pins
            this.allPins.forEach(pin => {
                let colToPin = this.rowColToPin[pin.row];
                if (!colToPin)
                    colToPin = this.rowColToPin[pin.row] = {};
                colToPin[pin.col] = pin;
            })

            //-----labels
            const mkBBLabelAtPin = (row: string, col: string, xOffset: number, yOffset: number, txt: string, group?: string): GridLabel => {
                let size = PIN_LBL_SIZE;
                let rotation = LBL_ROTATION;
                let loc = this.getCoord({ type: "breadboard", row: row, col: col });
                let [cx, cy] = loc;
                let t = mkBBLabel(cx + xOffset, cy + yOffset, size, rotation, txt, group);
                return t;
            }

            //columns
            for (let colIdx = 0; colIdx < BREADBOARD_MID_COLS; colIdx++) {
                let colNm = getColumnName(colIdx);
                //top
                let rowTIdx = 0;
                let rowTNm = getRowName(rowTIdx);
                let groupT = getMidGroupName(rowTIdx, colIdx);
                let lblT = mkBBLabelAtPin(rowTNm, colNm, 0, -PIN_DIST, colNm, groupT);
                this.allLabels.push(lblT);
                //bottom
                let rowBIdx = BREADBOARD_MID_ROWS - 1;
                let rowBNm = getRowName(rowBIdx);
                let groupB = getMidGroupName(rowBIdx, colIdx);
                let lblB = mkBBLabelAtPin(rowBNm, colNm, 0, +PIN_DIST, colNm, groupB);
                this.allLabels.push(lblB);
            }
            //rows
            for (let rowIdx = 0; rowIdx < BREADBOARD_MID_ROWS; rowIdx++) {
                let rowNm = getRowName(rowIdx);
                //top
                let colTIdx = 0;
                let colTNm = getColumnName(colTIdx);
                let lblT = mkBBLabelAtPin(rowNm, colTNm, -PIN_DIST, 0, rowNm);
                this.allLabels.push(lblT);
                //top
                let colBIdx = BREADBOARD_MID_COLS - 1;
                let colBNm = getColumnName(colBIdx);
                let lblB = mkBBLabelAtPin(rowNm, colBNm, +PIN_DIST, 0, rowNm);
                this.allLabels.push(lblB);
            }

            //+- labels
            let botPowerLabels = [
                //BL
                mkBBLabel(0 + POWER_LBL_OFFSET + MINUS_LBL_EXTRA_OFFSET, BAR_HEIGHT + MID_HEIGHT + POWER_LBL_OFFSET, MINUS_LBL_SIZE, LBL_ROTATION, `-`, getBarGroupName(0, 0), [`sim-bb-blue`]),
                mkBBLabel(0 + POWER_LBL_OFFSET, BAR_HEIGHT + MID_HEIGHT + BAR_HEIGHT - POWER_LBL_OFFSET, PLUS_LBL_SIZE, LBL_ROTATION, `+`, getBarGroupName(1, 0), [`sim-bb-red`]),
                //BR
                mkBBLabel(WIDTH - POWER_LBL_OFFSET + MINUS_LBL_EXTRA_OFFSET, BAR_HEIGHT + MID_HEIGHT + POWER_LBL_OFFSET, MINUS_LBL_SIZE, LBL_ROTATION, `-`, getBarGroupName(0, BAR_COLS - 1), [`sim-bb-blue`]),
                mkBBLabel(WIDTH - POWER_LBL_OFFSET, BAR_HEIGHT + MID_HEIGHT + BAR_HEIGHT - POWER_LBL_OFFSET, PLUS_LBL_SIZE, LBL_ROTATION, `+`, getBarGroupName(1, BAR_COLS - 1), [`sim-bb-red`]),
            ];
            this.allLabels = this.allLabels.concat(botPowerLabels);
            let topPowerLabels = [
                //TL
                mkBBLabel(0 + POWER_LBL_OFFSET + MINUS_LBL_EXTRA_OFFSET, 0 + POWER_LBL_OFFSET, MINUS_LBL_SIZE, LBL_ROTATION, `-`, getBarGroupName(0, BAR_COLS), [`sim-bb-blue`]),
                mkBBLabel(0 + POWER_LBL_OFFSET, BAR_HEIGHT - POWER_LBL_OFFSET, PLUS_LBL_SIZE, LBL_ROTATION, `+`, getBarGroupName(1, BAR_COLS), [`sim-bb-red`]),
                //TR
                mkBBLabel(WIDTH - POWER_LBL_OFFSET + MINUS_LBL_EXTRA_OFFSET, 0 + POWER_LBL_OFFSET, MINUS_LBL_SIZE, LBL_ROTATION, `-`, getBarGroupName(0, POWER_COLS - 1), [`sim-bb-blue`]),
                mkBBLabel(WIDTH - POWER_LBL_OFFSET, BAR_HEIGHT - POWER_LBL_OFFSET, PLUS_LBL_SIZE, LBL_ROTATION, `+`, getBarGroupName(1, POWER_COLS - 1), [`sim-bb-red`]),
            ];
            this.allLabels = this.allLabels.concat(topPowerLabels);

            //catalog lbls
            let lblNmToLbls: Map<GridLabel[]> = {};
            this.allLabels.forEach(lbl => {
                let { el, txt } = lbl;
                let lbls = lblNmToLbls[txt] = lblNmToLbls[txt] || []
                lbls.push(lbl);
            });
            const isPowerPin = (pin: GridPin) => pin.row === "-" || pin.row === "+";
            this.allPins.forEach(pin => {
                let { row, col, group } = pin;
                let colToLbls = this.rowColToLbls[row] || (this.rowColToLbls[row] = {});
                let lbls = colToLbls[col] || (colToLbls[col] = []);
                if (isPowerPin(pin)) {
                    //power pins
                    let isBot = Number(col) <= BAR_COLS;
                    if (isBot)
                        botPowerLabels.filter(l => l.group == pin.group).forEach(l => lbls.push(l));
                    else
                        topPowerLabels.filter(l => l.group == pin.group).forEach(l => lbls.push(l));
                } else {
                    //mid pins
                    let rowLbls = lblNmToLbls[row];
                    rowLbls.forEach(l => lbls.push(l));
                    let colLbls = lblNmToLbls[col];
                    colLbls.forEach(l => lbls.push(l));
                }
            })

            //-----blue & red lines
            const lnLen = BAR_GRID_WIDTH + PIN_DIST * 1.5;
            const lnThickness = PIN_DIST / 5.0;
            const lnYOff = PIN_DIST * 0.6;
            const lnXOff = (lnLen - BAR_GRID_WIDTH) / 2.0;
            const mkPowerLine = (x: number, y: number, group: string, cls: string): BBBar => {
                let ln = <SVGRectElement>svg.elt("rect");
                svg.hydrate(ln, {
                    class: `sim-bb-bar ${cls}`,
                    x: x,
                    y: y - lnThickness / 2.0,
                    width: lnLen,
                    height: lnThickness
                });
                let bar: BBBar = { el: ln, group: group };
                return bar;
            }
            let barLines = [
                //top
                mkPowerLine(BAR_BOT_GRID_X - lnXOff, BAR_BOT_GRID_Y - lnYOff, getBarGroupName(0, POWER_COLS - 1), "sim-bb-blue"),
                mkPowerLine(BAR_BOT_GRID_X - lnXOff, BAR_BOT_GRID_Y + PIN_DIST + lnYOff, getBarGroupName(1, POWER_COLS - 1), "sim-bb-red"),
                //bot
                mkPowerLine(BAR_TOP_GRID_X - lnXOff, BAR_TOP_GRID_Y - lnYOff, getBarGroupName(0, 0), "sim-bb-blue"),
                mkPowerLine(BAR_TOP_GRID_X - lnXOff, BAR_TOP_GRID_Y + PIN_DIST + lnYOff, getBarGroupName(1, 0), "sim-bb-red"),
            ];
            this.allPowerBars = this.allPowerBars.concat(barLines);
            //attach power bars
            this.allPowerBars.forEach(b => this.bb.appendChild(b.el));

            //-----electrically connected groups
            //make groups
            let allGrpNms = this.allPins.map(p => p.group).filter((g, i, a) => a.indexOf(g) == i);
            let groups: SVGGElement[] = allGrpNms.map(grpNm => {
                let g = <SVGGElement>svg.elt("g");
                return g;
            });
            groups.forEach(g => svg.addClass(g, "sim-bb-pin-group"));
            groups.forEach((g, i) => svg.addClass(g, `group-${allGrpNms[i]}`));
            let grpNmToGroup: Map<SVGGElement> = {};
            allGrpNms.forEach((g, i) => grpNmToGroup[g] = groups[i]);
            //group pins and add connecting wire
            let grpNmToPins: Map<GridPin[]> = {};
            this.allPins.forEach((p, i) => {
                let g = p.group;
                let pins = grpNmToPins[g] || (grpNmToPins[g] = []);
                pins.push(p);
            });
            //connecting wire
            allGrpNms.forEach(grpNm => {
                let pins = grpNmToPins[grpNm];
                let [xs, ys] = [pins.map(p => p.cx), pins.map(p => p.cy)];
                let minFn = (arr: number[]) => arr.reduce((a, b) => a < b ? a : b);
                let maxFn = (arr: number[]) => arr.reduce((a, b) => a > b ? a : b);
                let [minX, maxX, minY, maxY] = [minFn(xs), maxFn(xs), minFn(ys), maxFn(ys)];
                let wire = svg.elt("rect");
                let width = Math.max(maxX - minX, 0.0001/*rects with no width aren't displayed*/);
                let height = Math.max(maxY - minY, 0.0001);
                svg.hydrate(wire, { x: minX, y: minY, width: width, height: height });
                svg.addClass(wire, "sim-bb-group-wire")
                let g = grpNmToGroup[grpNm];
                g.appendChild(wire);
            });
            //group pins
            this.allPins.forEach(p => {
                let g = grpNmToGroup[p.group];
                g.appendChild(p.el);
                g.appendChild(p.hoverEl);
            })
            //group lbls
            let miscLblGroup = <SVGGElement>svg.elt("g");
            svg.hydrate(miscLblGroup, { class: "sim-bb-group-misc" });
            groups.push(miscLblGroup);
            this.allLabels.forEach(l => {
                if (l.group) {
                    let g = grpNmToGroup[l.group];
                    g.appendChild(l.el);
                    g.appendChild(l.hoverEl);
                } else {
                    miscLblGroup.appendChild(l.el);
                    miscLblGroup.appendChild(l.hoverEl);
                }
            })

            //attach to bb
            groups.forEach(g => this.bb.appendChild(g)); //attach to breadboard
        }

        public getSVGAndSize(): SVGAndSize<SVGSVGElement> {
            return { el: this.bb, y: 0, x: 0, w: WIDTH, h: HEIGHT };
        }

        public highlightLoc(rowCol: BBLoc) {
            let { row, col } = rowCol;
            let pin = this.rowColToPin[row][col];
            let { cx, cy } = pin;
            let lbls = this.rowColToLbls[row][col];
            const highlightLbl = (lbl: GridLabel) => {
                svg.addClass(lbl.el, "highlight");
                svg.addClass(lbl.hoverEl, "highlight");
            };
            lbls.forEach(highlightLbl);
        }
    }
}