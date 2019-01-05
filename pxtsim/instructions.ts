namespace pxsim.instructions {
    const LOC_LBL_SIZE = 10;
    const QUANT_LBL_SIZE = 30;
    const QUANT_LBL = (q: number) => `${q}x`;
    const WIRE_QUANT_LBL_SIZE = 20;
    const LBL_VERT_PAD = 3;
    const LBL_RIGHT_PAD = 5;
    const LBL_LEFT_PAD = 5;
    const REQ_WIRE_HEIGHT = 40;
    const REQ_CMP_HEIGHT = 50;
    const REQ_CMP_SCALE = 0.5 * 3;
    type Orientation = "landscape" | "portrait";
    const ORIENTATION: Orientation = "portrait";
    const PPI = 96.0;
    const PAGE_SCALAR = 0.95;
    const [FULL_PAGE_WIDTH, FULL_PAGE_HEIGHT]
        = (ORIENTATION == "portrait" ? [PPI * 8.5 * PAGE_SCALAR, PPI * 11.0 * PAGE_SCALAR] : [PPI * 11.0 * PAGE_SCALAR, PPI * 8.5 * PAGE_SCALAR]);
    const PAGE_MARGIN = PPI * 0.45;
    const PAGE_WIDTH = FULL_PAGE_WIDTH - PAGE_MARGIN * 2;
    const PAGE_HEIGHT = FULL_PAGE_HEIGHT - PAGE_MARGIN * 2;
    const BORDER_COLOR = "gray";
    const BORDER_RADIUS = 5 * 4;
    const BORDER_WIDTH = 2 * 2;
    const [PANEL_ROWS, PANEL_COLS] = [1, 1];
    const PANEL_MARGIN = 20;
    const PANEL_PADDING = 8 * 3;
    const PANEL_WIDTH = PAGE_WIDTH / PANEL_COLS - (PANEL_MARGIN + PANEL_PADDING + BORDER_WIDTH) * PANEL_COLS;
    const PANEL_HEIGHT = PAGE_HEIGHT / PANEL_ROWS - (PANEL_MARGIN + PANEL_PADDING + BORDER_WIDTH) * PANEL_ROWS;
    const BOARD_WIDTH = 465;
    const BOARD_LEFT = (PANEL_WIDTH - BOARD_WIDTH) / 2.0 + PANEL_PADDING;
    const BOARD_BOT = PANEL_PADDING;
    const NUM_BOX_SIZE = 120;
    const NUM_FONT = 80;
    const NUM_MARGIN = 10;
    const FRONT_PAGE_BOARD_WIDTH = 400;
    const PART_SCALAR = 1.7;
    const PARTS_BOARD_SCALE = 0.17;
    const PARTS_BB_SCALE = 0.25;
    const PARTS_CMP_SCALE = 0.3;
    const PARTS_WIRE_SCALE = 0.23;
    const BACK_PAGE_BOARD_WIDTH = PANEL_WIDTH - PANEL_PADDING * 1.5;
    const STYLE = `
            .instr-panel {
                margin: ${PANEL_MARGIN}px;
                padding: ${PANEL_PADDING}px;
                border-width: ${BORDER_WIDTH}px;
                border-color: ${BORDER_COLOR};
                border-style: solid;
                border-radius: ${BORDER_RADIUS}px;
                display: inline-block;
                width: ${PANEL_WIDTH}px;
                height: ${PANEL_HEIGHT}px;
                position: relative;
                overflow: hidden;
                page-break-inside: avoid;
            }
            .board-svg {
                margin: 0 auto;
                display: block;
                position: absolute;
                bottom: ${BOARD_BOT}px;
                left: ${BOARD_LEFT}px;
            }
            .panel-num-outer {
                position: absolute;
                left: ${-BORDER_WIDTH}px;
                top: ${-BORDER_WIDTH}px;
                width: ${NUM_BOX_SIZE}px;
                height: ${NUM_BOX_SIZE}px;
                border-width: ${BORDER_WIDTH}px;
                border-style: solid;
                border-color: ${BORDER_COLOR};
                border-radius: ${BORDER_RADIUS}px 0 ${BORDER_RADIUS}px 0;
            }
            .panel-num {
                margin: ${NUM_MARGIN}px 0;
                text-align: center;
                font-size: ${NUM_FONT}px;
            }
            .cmp-div {
                display: inline-block;
            }
            .reqs-div {
                margin-left: ${PANEL_PADDING + NUM_BOX_SIZE}px;
                margin-top: 5px;
            }
            .partslist-wire,
            .partslist-cmp {
                margin: 10px;
            }
            .partslist-wire {
                display: inline-block;
            }
            `;

    function addClass(el: HTMLElement, cls: string) {
        //TODO move to library
        if (el.classList) el.classList.add(cls);
        //BUG: won't work if element has class that is prefix of new class
        //TODO: make github issue (same issue exists svg.addClass)
        else if (el.className.indexOf(cls) < 0) el.className += " " + cls;
    }
    function mkTxt(p: [number, number], txt: string, size: number) {
        let el = svg.elt("text")
        let [x, y] = p;
        svg.hydrate(el, { x: x, y: y, style: `font-size:${size}px;` });
        el.textContent = txt;
        return el;
    }
    type mkCmpDivOpts = {
        top?: string,
        topSize?: number,
        right?: string,
        rightSize?: number,
        left?: string,
        leftSize?: number,
        bot?: string,
        botSize?: number,
        wireClr?: string,
        cmpWidth?: number,
        cmpHeight?: number,
        cmpScale?: number,
        crocClips?: boolean
    };

    function mkBoardImgSvg(def: BoardDefinition): visuals.SVGElAndSize {
        const boardView = pxsim.visuals.mkBoardView({
            visual: def.visual,
            boardDef: def
        });
        return boardView.getView();
    }

    function mkBBSvg(): visuals.SVGElAndSize {
        const bb = new visuals.Breadboard({});
        return bb.getSVGAndSize();
    }
    function wrapSvg(el: visuals.SVGElAndSize, opts: mkCmpDivOpts): HTMLElement {
        //TODO: Refactor this function; it is too complicated. There is a lot of error-prone math being done
        // to scale and place all elements which could be simplified with more forethought.
        let svgEl = <SVGSVGElement>document.createElementNS("http://www.w3.org/2000/svg", "svg");
        let dims = { l: 0, t: 0, w: 0, h: 0 };

        let cmpSvgEl = <SVGSVGElement>document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svgEl.appendChild(cmpSvgEl);

        cmpSvgEl.appendChild(el.el);
        let cmpSvgAtts = {
            "viewBox": `${el.x} ${el.y} ${el.w} ${el.h}`,
            "preserveAspectRatio": "xMidYMid",
        };
        dims.w = el.w;
        dims.h = el.h;
        let scale = (scaler: number) => {
            dims.h *= scaler;
            dims.w *= scaler;
            (<any>cmpSvgAtts).width = dims.w;
            (<any>cmpSvgAtts).height = dims.h;
        }
        if (opts.cmpScale) {
            scale(opts.cmpScale)
        }
        if (opts.cmpWidth && opts.cmpWidth < dims.w) {
            scale(opts.cmpWidth / dims.w);
        } else if (opts.cmpHeight && opts.cmpHeight < dims.h) {
            scale(opts.cmpHeight / dims.h)
        }
        svg.hydrate(cmpSvgEl, cmpSvgAtts);
        let elDims = { l: dims.l, t: dims.t, w: dims.w, h: dims.h };

        let updateL = (newL: number) => {
            if (newL < dims.l) {
                let extraW = dims.l - newL;
                dims.l = newL;
                dims.w += extraW;
            }
        }
        let updateR = (newR: number) => {
            let oldR = dims.l + dims.w;
            if (oldR < newR) {
                let extraW = newR - oldR;
                dims.w += extraW;
            }
        }
        let updateT = (newT: number) => {
            if (newT < dims.t) {
                let extraH = dims.t - newT;
                dims.t = newT;
                dims.h += extraH;
            }
        }
        let updateB = (newB: number) => {
            let oldB = dims.t + dims.h;
            if (oldB < newB) {
                let extraH = newB - oldB;
                dims.h += extraH;
            }
        }

        //labels
        let [xOff, yOff] = [-0.3, 0.3]; //HACK: these constants tweak the way "mkTxt" knows how to center the text
        const txtAspectRatio = [1.4, 1.0];
        if (opts && opts.top) {
            let size = opts.topSize;
            let txtW = size / txtAspectRatio[0];
            let txtH = size / txtAspectRatio[1];
            let [cx, y] = [elDims.l + elDims.w / 2, elDims.t - LBL_VERT_PAD - txtH / 2];
            let lbl = visuals.mkTxt(cx, y, size, 0, opts.top, xOff, yOff);
            svg.addClass(lbl, "cmp-lbl");
            svgEl.appendChild(lbl);

            let len = txtW * opts.top.length;
            updateT(y - txtH / 2);
            updateL(cx - len / 2);
            updateR(cx + len / 2);
        }
        if (opts && opts.bot) {
            let size = opts.botSize;
            let txtW = size / txtAspectRatio[0];
            let txtH = size / txtAspectRatio[1];
            let [cx, y] = [elDims.l + elDims.w / 2, elDims.t + elDims.h + LBL_VERT_PAD + txtH / 2];
            let lbl = visuals.mkTxt(cx, y, size, 0, opts.bot, xOff, yOff);
            svg.addClass(lbl, "cmp-lbl");
            svgEl.appendChild(lbl);

            let len = txtW * opts.bot.length;
            updateB(y + txtH / 2);
            updateL(cx - len / 2);
            updateR(cx + len / 2);
        }
        if (opts && opts.right) {
            let size = opts.rightSize;
            let txtW = size / txtAspectRatio[0];
            let txtH = size / txtAspectRatio[1];
            let len = txtW * opts.right.length;
            let [cx, cy] = [elDims.l + elDims.w + LBL_RIGHT_PAD + len / 2, elDims.t + elDims.h / 2];
            let lbl = visuals.mkTxt(cx, cy, size, 0, opts.right, xOff, yOff);
            svg.addClass(lbl, "cmp-lbl");
            svgEl.appendChild(lbl);

            updateT(cy - txtH / 2);
            updateR(cx + len / 2);
            updateB(cy + txtH / 2);
        }
        if (opts && opts.left) {
            let size = opts.leftSize;
            let txtW = size / txtAspectRatio[0];
            let txtH = size / txtAspectRatio[1];
            let len = txtW * opts.left.length;
            let [cx, cy] = [elDims.l - LBL_LEFT_PAD - len / 2, elDims.t + elDims.h / 2];
            let lbl = visuals.mkTxt(cx, cy, size, 0, opts.left, xOff, yOff);
            svg.addClass(lbl, "cmp-lbl");
            svgEl.appendChild(lbl);

            updateT(cy - txtH / 2);
            updateL(cx - len / 2);
            updateB(cy + txtH / 2);
        }

        let svgAtts = {
            "viewBox": `${dims.l} ${dims.t} ${dims.w} ${dims.h}`,
            "width": dims.w * PART_SCALAR,
            "height": dims.h * PART_SCALAR,
            "preserveAspectRatio": "xMidYMid",
        };
        svg.hydrate(svgEl, svgAtts);
        let div = document.createElement("div");
        div.appendChild(svgEl);
        return div;
    }
    function mkCmpDiv(cmp: "wire" | PartVisualDefinition, opts: mkCmpDivOpts): HTMLElement {
        let state = runtime.board as pxsim.CoreBoard;
        let el: visuals.SVGElAndSize;
        if (cmp == "wire") {
            el = visuals.mkWirePart([0, 0], opts.wireClr || "red", opts.crocClips);
        } else {
            let partVis = <PartVisualDefinition>cmp;
            if (typeof partVis.builtIn == "string") {
                let cnstr = state.builtinPartVisuals[partVis.builtIn];
                el = cnstr([0, 0]);
            } else {
                el = visuals.mkGenericPartSVG(partVis);
            }
        }
        return wrapSvg(el, opts);
    }
    type BoardProps = {
        boardDef: BoardDefinition,
        cmpDefs: Map<PartDefinition>,
        fnArgs: any,
        allAlloc: AllocatorResult,
        stepToWires: WireInst[][],
        stepToCmps: PartInst[][]
        allWires: WireInst[],
        allCmps: PartInst[],
        lastStep: number,
        colorToWires: Map<WireInst[]>,
        allWireColors: string[],
    };
    function mkBoardProps(allocOpts: AllocatorOpts): BoardProps {
        let allocRes = allocateDefinitions(allocOpts);
        let stepToWires: WireInst[][] = [];
        let stepToCmps: PartInst[][] = [];
        let stepOffset = 1;
        allocRes.partsAndWires.forEach(cAndWs => {
            let part = cAndWs.part;
            let wires = cAndWs.wires;
            cAndWs.assembly.forEach((step, idx) => {
                if (step.part && part)
                    stepToCmps[stepOffset + idx] = [part]
                if (step.wireIndices && step.wireIndices.length > 0 && wires)
                    stepToWires[stepOffset + idx] = step.wireIndices.map(i => wires[i])
            })
            stepOffset += cAndWs.assembly.length;
        });
        let numSteps = stepOffset;
        let lastStep = numSteps - 1;
        let allCmps = allocRes.partsAndWires.map(r => r.part).filter(p => !!p);
        let allWires = allocRes.partsAndWires.map(r => r.wires || []).reduce((p, n) => p.concat(n), []);
        let colorToWires: Map<WireInst[]> = {}
        let allWireColors: string[] = [];
        allWires.forEach(w => {
            if (!colorToWires[w.color]) {
                colorToWires[w.color] = [];
                allWireColors.push(w.color);
            }
            colorToWires[w.color].push(w);
        });
        return {
            boardDef: allocOpts.boardDef,
            cmpDefs: allocOpts.partDefs,
            fnArgs: allocOpts.fnArgs,
            allAlloc: allocRes,
            stepToWires: stepToWires,
            stepToCmps: stepToCmps,
            allWires: allWires,
            allCmps: allCmps,
            lastStep: lastStep,
            colorToWires: colorToWires,
            allWireColors: allWireColors,
        };
    }
    function mkBlankBoardAndBreadboard(props: BoardProps, width: number, buildMode: boolean = false): visuals.BoardHost {
        const state = runtime.board as pxsim.CoreBoard;
        const opts: visuals.BoardHostOpts = {
            state: state,
            boardDef: props.boardDef,
            forceBreadboardLayout: true,
            forceBreadboardRender: props.allAlloc.requiresBreadboard,
            partDefs: props.cmpDefs,
            maxWidth: `${width}px`,
            fnArgs: props.fnArgs,
            wireframe: buildMode,
            partsList: []
        };
        let boardHost = new visuals.BoardHost(pxsim.visuals.mkBoardView({
            visual: opts.boardDef.visual,
            boardDef: opts.boardDef,
            wireframe: opts.wireframe
        }), opts);
        let view = boardHost.getView();
        svg.addClass(view, "board-svg");

        //set smiley
        //HACK
        // let img = board.board.displayCmp.image;
        // img.set(1, 0, 255);
        // img.set(3, 0, 255);
        // img.set(0, 2, 255);
        // img.set(1, 3, 255);
        // img.set(2, 3, 255);
        // img.set(3, 3, 255);
        // img.set(4, 2, 255);
        // board.updateState();

        return boardHost;
    }
    function drawSteps(board: visuals.BoardHost, step: number, props: BoardProps) {
        let view = board.getView();
        if (step > 0) {
            svg.addClass(view, "grayed");
        }

        for (let i = 0; i <= step; i++) {
            let cmps = props.stepToCmps[i];
            if (cmps) {
                cmps.forEach(partInst => {
                    let cmp = board.addPart(partInst)
                    //last step
                    if (i === step) {
                        //highlight locations pins
                        partInst.breadboardConnections.forEach(bbLoc => board.highlightBreadboardPin(bbLoc));
                        svg.addClass(cmp.element, "notgrayed");
                    }
                });
            }

            let wires = props.stepToWires[i];
            if (wires) {
                wires.forEach(w => {
                    let wire = board.addWire(w);
                    if (!wire) return;
                    //last step
                    if (i === step) {
                        //location highlights
                        if (w.start.type == "breadboard") {
                            let lbls = board.highlightBreadboardPin((<BBLoc>w.start));
                        } else {
                            board.highlightBoardPin((<BoardLoc>w.start).pin);
                        }
                        if (w.end.type == "breadboard") {
                            board.highlightBreadboardPin((<BBLoc>w.end));
                        } else {
                            board.highlightBoardPin((<BoardLoc>w.end).pin);
                        }
                        //highlight wire
                        board.highlightWire(wire);
                    }
                });
            }
        }
    }
    function mkPanel() {
        //panel
        let panel = document.createElement("div");
        addClass(panel, "instr-panel");

        return panel;
    }
    function mkPartsPanel(props: BoardProps) {
        let panel = mkPanel();

        // board and breadboard
        let boardImg = mkBoardImgSvg(props.boardDef);
        let board = wrapSvg(boardImg, { left: QUANT_LBL(1), leftSize: QUANT_LBL_SIZE, cmpScale: PARTS_BOARD_SCALE });
        panel.appendChild(board);
        let bbRaw = mkBBSvg();
        let bb = wrapSvg(bbRaw, { left: QUANT_LBL(1), leftSize: QUANT_LBL_SIZE, cmpScale: PARTS_BB_SCALE });
        panel.appendChild(bb);

        // components
        let cmps = props.allCmps;
        cmps.forEach(c => {
            let quant = 1;
            // TODO: don't special case this
            if (c.visual.builtIn === "buttonpair") {
                quant = 2;
            }
            let cmp = mkCmpDiv(c.visual, {
                left: QUANT_LBL(quant),
                leftSize: QUANT_LBL_SIZE,
                cmpScale: PARTS_CMP_SCALE,
            });
            addClass(cmp, "partslist-cmp");
            panel.appendChild(cmp);
        });

        // wires
        props.allWireColors.forEach(clr => {
            let quant = props.colorToWires[clr].length;
            let style = props.boardDef.pinStyles[clr] || "female";
            let cmp = mkCmpDiv("wire", {
                left: QUANT_LBL(quant),
                leftSize: WIRE_QUANT_LBL_SIZE,
                wireClr: clr,
                cmpScale: PARTS_WIRE_SCALE,
                crocClips: style == "croc"
            })
            addClass(cmp, "partslist-wire");
            panel.appendChild(cmp);
        })

        return panel;
    }
    function mkStepPanel(step: number, props: BoardProps) {
        let panel = mkPanel();

        //board
        let board = mkBlankBoardAndBreadboard(props, BOARD_WIDTH, true)
        drawSteps(board, step, props);
        panel.appendChild(board.getView());

        //number
        let numDiv = document.createElement("div");
        addClass(numDiv, "panel-num-outer");
        addClass(numDiv, "noselect");
        panel.appendChild(numDiv)
        let num = document.createElement("div");
        addClass(num, "panel-num");
        num.textContent = (step + 1) + "";
        numDiv.appendChild(num)

        // add requirements
        let reqsDiv = document.createElement("div");
        addClass(reqsDiv, "reqs-div")
        panel.appendChild(reqsDiv);
        let wires = (props.stepToWires[step] || []);
        let mkLabel = (loc: Loc) => {
            if (loc.type === "breadboard") {
                let { row, col } = (<BBLoc>loc);
                return `(${row},${col})`
            } else
                return (<BoardLoc>loc).pin;
        };
        wires.forEach(w => {
            let croc = false;
            if (w.end.type == "dalboard") {
                croc = props.boardDef.pinStyles[(<BoardLoc>w.end).pin] == "croc";
            }
            let cmp = mkCmpDiv("wire", {
                top: mkLabel(w.end),
                topSize: LOC_LBL_SIZE,
                bot: mkLabel(w.start),
                botSize: LOC_LBL_SIZE,
                wireClr: w.color,
                cmpHeight: REQ_WIRE_HEIGHT,
                crocClips: croc
            })
            addClass(cmp, "cmp-div");
            reqsDiv.appendChild(cmp);
        });
        let cmps = (props.stepToCmps[step] || []);
        cmps.forEach(c => {
            let locs: BBLoc[];
            if (c.visual.builtIn === "buttonpair") {
                //TODO: don't special case this
                locs = [c.breadboardConnections[0], c.breadboardConnections[2]]
            } else {
                locs = [c.breadboardConnections[0]];
            }
            locs.forEach((l, i) => {
                let topLbl: string;
                if (l) {
                    let { row, col } = l;
                    topLbl = `(${row},${col})`;
                } else {
                    topLbl = "";
                }
                let scale = REQ_CMP_SCALE;
                if (c.visual.builtIn === "buttonpair")
                    scale *= 0.5; //TODO: don't special case
                let cmp = mkCmpDiv(c.visual, {
                    top: topLbl,
                    topSize: LOC_LBL_SIZE,
                    cmpHeight: REQ_CMP_HEIGHT,
                    cmpScale: scale
                })
                addClass(cmp, "cmp-div");
                reqsDiv.appendChild(cmp);
            });
        });

        return panel;
    }
    function updateFrontPanel(props: BoardProps): [HTMLElement, BoardProps] {
        let panel = document.getElementById("front-panel");

        let board = mkBlankBoardAndBreadboard(props, FRONT_PAGE_BOARD_WIDTH, false);
        board.addAll(props.allAlloc);
        panel.appendChild(board.getView());

        return [panel, props];
    }
    function mkFinalPanel(props: BoardProps) {

        let panel = mkPanel();
        addClass(panel, "back-panel");
        let board = mkBlankBoardAndBreadboard(props, BACK_PAGE_BOARD_WIDTH, false)
        board.addAll(props.allAlloc);
        panel.appendChild(board.getView());

        return panel;
    }

    export interface RenderPartsOptions {
        name: string;
        boardDef: BoardDefinition;
        parts: string[];
        partDefinitions: Map<PartDefinition>;
        fnArgs: any;
        configData: pxsim.ConfigData;
        print?: boolean;
    }

    export function renderParts(container: HTMLElement, options: RenderPartsOptions) {
        if (!options.boardDef.pinStyles)
            options.boardDef.pinStyles = {};
        if (options.configData)
            pxsim.setConfigData(options.configData.cfg, options.configData.cfgKey);

        const msg: SimulatorRunMessage = {
            type: "run",
            code: "",
            boardDefinition: options.boardDef,
            partDefinitions: options.partDefinitions
        }
        pxsim.runtime = new Runtime(msg);
        pxsim.runtime.board = null;
        pxsim.initCurrentRuntime(msg); // TODO it seems Runtime() ctor already calls this?

        let style = document.createElement("style");
        style.textContent += STYLE;
        document.head.appendChild(style);

        const cmpDefs = options.partDefinitions;

        //props
        let dummyBreadboard = new visuals.Breadboard({});
        let props = mkBoardProps({
            boardDef: options.boardDef,
            partDefs: cmpDefs,
            partsList: options.parts,
            fnArgs: options.fnArgs,
            getBBCoord: dummyBreadboard.getCoord.bind(dummyBreadboard)
        });

        //front page
        let frontPanel = updateFrontPanel(props);

        //all required parts
        let partsPanel = mkPartsPanel(props);
        container.appendChild(partsPanel);

        //steps
        for (let s = 0; s <= props.lastStep; s++) {
            let p = mkStepPanel(s, props);
            container.appendChild(p);
        }

        //final
        //let finalPanel = mkFinalPanel(props);
        //container.appendChild(finalPanel);

        if (options.print)
            pxsim.print(2000);
    }

    export function renderInstructions(msg: SimulatorInstructionsMessage) {
        document.getElementById("proj-title").innerText = msg.options.name || "";
        renderParts(document.body, msg.options)
    }
}