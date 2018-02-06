namespace pxsim.visuals {
    export function mkBtnSvg(xy: Coord): SVGAndSize<SVGGElement> {
        let [innerCls, outerCls] = ["sim-button", "sim-button-outer"];
        const tabSize = PIN_DIST / 2.5;
        const pegR = PIN_DIST / 5;
        const btnR = PIN_DIST * .8;
        const pegMargin = PIN_DIST / 8;
        const plateR = PIN_DIST / 12;

        const pegOffset = pegMargin + pegR;
        let [x, y] = xy;
        const left = x - tabSize / 2;
        const top = y - tabSize / 2;
        const plateH = 3 * PIN_DIST - tabSize;
        const plateW = 2 * PIN_DIST + tabSize;
        const plateL = left;
        const plateT = top + tabSize;
        const btnCX = plateL + plateW / 2;
        const btnCY = plateT + plateH / 2;

        let btng = <SVGGElement>svg.elt("g");
        //tabs
        const mkTab = (x: number, y: number) => {
            svg.child(btng, "rect", { class: "sim-button-tab", x: x, y: y, width: tabSize, height: tabSize})
        }
        mkTab(left, top);
        mkTab(left + 2 * PIN_DIST, top);
        mkTab(left, top + 3 * PIN_DIST);
        mkTab(left + 2 * PIN_DIST, top + 3 * PIN_DIST);

        //plate
        svg.child(btng, "rect", { class: outerCls, x: plateL, y: plateT, rx: plateR, ry: plateR, width: plateW, height: plateH });

        //pegs
        const mkPeg = (x: number, y: number) => {
            svg.child(btng, "circle", { class: "sim-button-nut", cx: x, cy: y, r: pegR });
        }
        mkPeg(plateL + pegOffset, plateT + pegOffset)
        mkPeg(plateL + plateW - pegOffset, plateT + pegOffset)
        mkPeg(plateL + pegOffset, plateT + plateH - pegOffset)
        mkPeg(plateL + plateW - pegOffset, plateT + plateH - pegOffset)

        //inner btn
        let innerBtn = svg.child(btng, "circle", { class: innerCls, cx: btnCX, cy: btnCY, r: btnR });

        //return
        return { el: btng, y: top, x: left, w: plateW, h: plateH + 2 * tabSize };
    }
    export const BUTTON_PAIR_STYLE = `
            .sim-button {
                pointer-events: none;
                fill: #000;
            }
            .sim-button-outer:active ~ .sim-button,
            .sim-button-virtual:active {
                fill: #FFA500;
            }
            .sim-button-outer {
                cursor: pointer;
                fill: #979797;
            }
            .sim-button-outer:hover {
                stroke:gray;
                stroke-width: ${PIN_DIST / 5}px;
            }
            .sim-button-nut {
                fill:#000;
                pointer-events:none;
            }
            .sim-button-nut:hover {
                stroke:${PIN_DIST / 15}px solid #704A4A;
            }
            .sim-button-tab {
                fill:#FFF;
                pointer-events:none;
            }
            .sim-button-virtual {
                cursor: pointer;
                fill: rgba(255, 255, 255, 0.6);
                stroke: rgba(255, 255, 255, 1);
                stroke-width: ${PIN_DIST / 5}px;
            }
            .sim-button-virtual:hover {
                stroke: rgba(128, 128, 128, 1);
            }
            .sim-text-virtual {
                fill: #000;
                pointer-events:none;
            }
            `;
    export class ButtonPairView implements IBoardPart<ButtonPairState> {
        public element: SVGElement;
        public defs: SVGElement[];
        public style = BUTTON_PAIR_STYLE;
        private state: ButtonPairState;
        private bus: EventBus;
        private aBtn: SVGGElement;
        private bBtn: SVGGElement;
        private abBtn: SVGGElement;

        public init(bus: EventBus, state: ButtonPairState) {
            this.state = state;
            this.bus = bus;
            this.defs = [];
            this.element = this.mkBtns();
            this.updateState();
            this.attachEvents();
        }

        public moveToCoord(xy: Coord) {
            let btnWidth = PIN_DIST * 3;
            let [x, y] = xy;
            translateEl(this.aBtn, [x, y])
            translateEl(this.bBtn, [x + btnWidth, y])
            translateEl(this.abBtn, [x + PIN_DIST * 1.5, y + PIN_DIST * 4])
        }

        public updateState() {
            let stateBtns = [this.state.aBtn, this.state.bBtn, this.state.abBtn];
            let svgBtns = [this.aBtn, this.bBtn, this.abBtn];

            if (this.state.usesButtonAB && this.abBtn.style.visibility != "visible") {
                this.abBtn.style.visibility = "visible";
            }
        }

        public updateTheme() {}

        private mkBtns() {
            this.aBtn = mkBtnSvg([0, 0]).el;
            this.bBtn = mkBtnSvg([0, 0]).el;

            const mkVirtualBtn = () => {
                const numPins = 2;
                const w = PIN_DIST * 2.8;
                const offset = (w - (numPins * PIN_DIST)) / 2;
                const corner = PIN_DIST / 2;
                const cx = 0 - offset + w / 2;
                const cy = cx;
                const txtSize = PIN_DIST * 1.3;
                const x = -offset;
                const y = -offset;
                const txtXOff = PIN_DIST / 7;
                const txtYOff = PIN_DIST / 10;

                let btng = <SVGGElement>svg.elt("g");
                let btn = svg.child(btng, "rect", { class: "sim-button-virtual", x: x, y: y, rx: corner, ry: corner, width: w, height: w});
                let btnTxt = mkTxt(cx + txtXOff, cy + txtYOff, txtSize, 0, "A+B");
                svg.addClass(btnTxt, "sim-text")
                svg.addClass(btnTxt, "sim-text-virtual");
                btng.appendChild(btnTxt);

                return btng;
            }

            this.abBtn = mkVirtualBtn();
            this.abBtn.style.visibility = "hidden";

            let el = svg.elt("g");
            svg.addClass(el, "sim-buttonpair")
            el.appendChild(this.aBtn);
            el.appendChild(this.bBtn);
            el.appendChild(this.abBtn);

            return el;
        }

        private attachEvents() {
            let btnStates = [this.state.aBtn, this.state.bBtn];
            let btnSvgs = [this.aBtn, this.bBtn];
            btnSvgs.forEach((btn, index) => {
                pxsim.pointerEvents.down.forEach(evid => btn.addEventListener(evid, ev => {
                    btnStates[index].pressed = true;
                }))
                btn.addEventListener(pointerEvents.leave, ev => {
                    btnStates[index].pressed = false;
                })
                btn.addEventListener(pointerEvents.up, ev => {
                    btnStates[index].pressed = false;
                    this.bus.queue(btnStates[index].id, this.state.props.BUTTON_EVT_UP);
                    this.bus.queue(btnStates[index].id, this.state.props.BUTTON_EVT_CLICK);
                })
            })
            let updateBtns = (s: boolean) => {
                btnStates.forEach(b => b.pressed = s)
            };
            pxsim.pointerEvents.down.forEach(evid => this.abBtn.addEventListener(evid, ev => {
                updateBtns(true);
            }));
            this.abBtn.addEventListener(pointerEvents.leave, ev => {
                updateBtns(false);
            })
            this.abBtn.addEventListener(pointerEvents.up, ev => {
                updateBtns(false);
                this.bus.queue(this.state.abBtn.id, this.state.props.BUTTON_EVT_UP);
                this.bus.queue(this.state.abBtn.id, this.state.props.BUTTON_EVT_CLICK);
            })
        }
    }
}