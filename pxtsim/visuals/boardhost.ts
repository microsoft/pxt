namespace pxsim.visuals {
    export interface BoardViewOptions {
        visual: string | BoardImageDefinition,
        boardDef: BoardDefinition,
        wireframe?: boolean,
        highContrast?: boolean,
        light?: boolean
    }

    export interface BoardHostOpts {
        state: CoreBoard,
        boardDef: BoardDefinition,
        partsList: string[],
        partDefs: Map<PartDefinition>,
        fnArgs: any,
        forceBreadboardLayout?: boolean,
        forceBreadboardRender?: boolean,
        maxWidth?: string,
        maxHeight?: string,
        wireframe?: boolean,
        highContrast?: boolean,
        light?: boolean
    }

    export let mkBoardView = (opts: BoardViewOptions): BoardView => {
        const boardVis = opts.visual as BoardImageDefinition;
        return new visuals.GenericBoardSvg({
            visualDef: boardVis,
            boardDef: opts.boardDef,
            wireframe: opts.wireframe,
        });
    }

    export class BoardHost {
        private opts: BoardHostOpts;
        private parts: IBoardPart<any>[] = [];
        private wireFactory: WireFactory;
        private breadboard: Breadboard;
        private fromBBCoord: (xy: Coord) => Coord;
        private fromMBCoord: (xy: Coord) => Coord;
        private boardView: BoardView;
        private view: SVGSVGElement;
        private partGroup: SVGGElement;
        private partOverGroup: SVGGElement;
        private style: SVGStyleElement;
        private defs: SVGDefsElement;
        private state: CoreBoard;

        constructor(view: BoardView, opts: BoardHostOpts) {
            this.boardView = view;
            this.opts = opts;
            if (!opts.boardDef.pinStyles)
                opts.boardDef.pinStyles = {};
            this.state = opts.state;
            let activeComponents = opts.partsList;

            let useBreadboardView = 0 < activeComponents.length || opts.forceBreadboardLayout;
            if (useBreadboardView) {
                this.breadboard = new Breadboard({
                    wireframe: opts.wireframe,
                });
                const bMarg = opts.boardDef.marginWhenBreadboarding || [0, 0, 40, 0];
                const composition = composeSVG({
                    el1: this.boardView.getView(),
                    scaleUnit1: this.boardView.getPinDist(),
                    el2: this.breadboard.getSVGAndSize(),
                    scaleUnit2: this.breadboard.getPinDist(),
                    margin: [bMarg[0], bMarg[1], 20, bMarg[3]],
                    middleMargin: bMarg[2],
                    maxWidth: opts.maxWidth,
                    maxHeight: opts.maxHeight,
                });
                const under = composition.under;
                const over = composition.over;
                this.view = composition.host;
                const edges = composition.edges;
                this.fromMBCoord = composition.toHostCoord1;
                this.fromBBCoord = composition.toHostCoord2;
                this.partGroup = over;
                this.partOverGroup = <SVGGElement>svg.child(this.view, "g");

                this.style = <SVGStyleElement>svg.child(this.view, "style", {});
                this.defs = <SVGDefsElement>svg.child(this.view, "defs", {});

                this.wireFactory = new WireFactory(under, over, edges, this.style,
                    this.getLocCoord.bind(this), this.getPinStyle.bind(this));

                const allocRes = allocateDefinitions({
                    boardDef: opts.boardDef,
                    partDefs: opts.partDefs,
                    fnArgs: opts.fnArgs,
                    getBBCoord: this.breadboard.getCoord.bind(this.breadboard),
                    partsList: activeComponents,
                });
                if (!allocRes.partsAndWires.length && !opts.forceBreadboardLayout) {
                    // nothing got allocated, so we rollback the changes.
                    useBreadboardView = false;
                }
                else {
                    this.addAll(allocRes);
                    if (!allocRes.requiresBreadboard && !opts.forceBreadboardRender)
                        useBreadboardView = false;
                }
            }

            if (!useBreadboardView) {
                // delete any kind of left over
                delete this.breadboard;
                delete this.wireFactory;
                delete this.partOverGroup;
                delete this.partGroup;
                delete this.style;
                delete this.defs;
                delete this.fromBBCoord;
                delete this.fromMBCoord;

                // allocate view
                const el = this.boardView.getView().el;
                this.view = el;
                this.partGroup = <SVGGElement>svg.child(this.view, "g");
                this.partOverGroup = <SVGGElement>svg.child(this.view, "g");
                if (opts.maxWidth)
                    svg.hydrate(this.view, { width: opts.maxWidth });
                if (opts.maxHeight)
                    svg.hydrate(this.view, { height: opts.maxHeight });
            }

            this.state.updateSubscribers.push(() => this.updateState());
        }

        public highlightBoardPin(pinNm: string) {
            this.boardView.highlightPin(pinNm);
        }

        public highlightBreadboardPin(rowCol: BBLoc) {
            this.breadboard.highlightLoc(rowCol);
        }

        public highlightWire(wire: Wire) {
            //TODO: move to wiring.ts
            //underboard wires
            wire.wires.forEach(e => {
                svg.addClass(e, "highlight");
                (<any>e).style["visibility"] = "visible";
            });

            //un greyed out
            svg.addClass(wire.endG, "highlight");
        }

        public getView(): SVGElement {
            return this.view;
        }

        public screenshotAsync(width?: number): Promise<ImageData> {
            const svg = this.view.cloneNode(true) as SVGSVGElement;
            svg.setAttribute('width', this.view.width.baseVal.value + "");
            svg.setAttribute('height', this.view.height.baseVal.value + "");
            const xml = new XMLSerializer().serializeToString(svg);
            const data = "data:image/svg+xml,"
                + encodeURIComponent(xml.replace(/\s+/g, ' ').replace(/"/g, "'"));

            return new Promise((resolve, reject) => {
                const img = document.createElement("img");
                img.onload = () => {
                    const cvs = document.createElement("canvas");
                    cvs.width = img.width;
                    cvs.height = img.height;

                    // check if a width or a height was specified
                    if (width > 0) {
                        cvs.width = width;
                        cvs.height = (img.height * width / img.width) | 0;
                    } else if (cvs.width < 200) {
                        cvs.width *= 2;
                        cvs.height *= 2;
                    } else if (cvs.width > 480) {
                        cvs.width /= 2;
                        cvs.height /= 2;
                    }
                    const ctx = cvs.getContext("2d");
                    ctx.drawImage(img, 0, 0, cvs.width, cvs.height);
                    resolve(ctx.getImageData(0, 0, cvs.width, cvs.height));
                };
                img.onerror = e => {
                    console.log(e);
                    resolve(undefined);
                }
                img.src = data;
            })
        }

        private updateState() {
            this.parts.forEach(c => c.updateState());
        }

        private getBBCoord(rowCol: BBLoc) {
            let bbCoord = this.breadboard.getCoord(rowCol);
            return this.fromBBCoord(bbCoord);
        }
        private getPinCoord(pin: string) {
            let boardCoord = this.boardView.getCoord(pin);
            if (!boardCoord) {
                console.error(`Unable to find coord for pin: ${pin}`);
                return undefined;
            }
            return this.fromMBCoord(boardCoord);
        }
        public getLocCoord(loc: Loc): Coord {
            let coord: Coord;
            if (loc.type === "breadboard") {
                let rowCol = (<BBLoc>loc);
                coord = this.getBBCoord(rowCol);
            } else {
                let pinNm = (<BoardLoc>loc).pin;
                coord = this.getPinCoord(pinNm);
            }
            if (!coord)
                console.debug("Unknown location: " + name)
            return coord;
        }
        public getPinStyle(loc: Loc): PinStyle {
            if (loc.type == "breadboard")
                return "female";
            else return this.opts.boardDef.pinStyles[(<BoardLoc>loc).pin] || "female";
        }

        public addPart(partInst: PartInst): IBoardPart<any> {
            let part: IBoardPart<any> = null;
            if (partInst.simulationBehavior) {
                //TODO: seperate simulation behavior from builtin visual
                let builtinBehavior = partInst.simulationBehavior;
                let cnstr = this.state.builtinVisuals[builtinBehavior];
                let stateFn = this.state.builtinParts[builtinBehavior];
                part = cnstr();
                part.init(this.state.bus, stateFn, this.view, partInst.params);
            } else {
                let vis = partInst.visual as PartVisualDefinition;
                part = new GenericPart(vis);
            }
            this.parts.push(part);
            this.partGroup.appendChild(part.element);
            if (part.overElement)
                this.partOverGroup.appendChild(part.overElement);
            if (part.defs)
                part.defs.forEach(d => this.defs.appendChild(d));
            this.style.textContent += part.style || "";
            let colIdx = partInst.startColumnIdx;
            let rowIdx = partInst.startRowIdx;
            let row = getRowName(rowIdx);
            let col = getColumnName(colIdx);
            let xOffset = partInst.bbFit.xOffset / partInst.visual.pinDistance;
            let yOffset = partInst.bbFit.yOffset / partInst.visual.pinDistance;
            let rowCol = <BBLoc>{
                type: "breadboard",
                row: row,
                col: col,
                xOffset: xOffset,
                yOffset: yOffset
            };
            let coord = this.getBBCoord(rowCol);
            part.moveToCoord(coord);
            let getCmpClass = (type: string) => `sim-${type}-cmp`;
            let cls = getCmpClass(partInst.name);
            svg.addClass(part.element, cls);
            svg.addClass(part.element, "sim-cmp");
            part.updateTheme();
            part.updateState();
            return part;
        }

        public addWire(inst: WireInst): Wire {
            return this.wireFactory.addWire(inst.start, inst.end, inst.color);
        }

        public addAll(allocRes: AllocatorResult) {
            allocRes.partsAndWires.forEach(pAndWs => {
                const wires = pAndWs.wires;
                const wiresOk = wires && wires.every(w => this.wireFactory.checkWire(w.start, w.end));
                if (wiresOk) // try to add all the wires
                    wires.forEach(w => allocRes.wires.push(this.addWire(w)));
                let part = pAndWs.part;
                if (part && (!wires || wiresOk))
                    allocRes.parts.push(this.addPart(part));
            });

            // at least one wire
            allocRes.requiresBreadboard = !!allocRes.wires.length
                || !!allocRes.parts.length;
        }
    }
}