namespace pxsim.visuals {
    export function mkMicroServoPart(xy: Coord = [0, 0]): SVGElAndSize {
        // TODO
        return { el: null, y: 0, x: 0, w: 0, h: 0 };
    }

    export class MicroServoView implements IBoardPart<MicroServoState> {
        public style: string = "";
        public overElement: SVGElement = undefined;
        public element: SVGElement;
        public defs: SVGElement[] = [];
        public state: MicroServoState;
        public bus: EventBus;
        private currentAngle = 0;
        private targetAngle = 0;

        private crankEl: SVGGElement;
        private crankTransform: string;

        public init(bus: EventBus, state: MicroServoState) {
            this.state = state;
            this.bus = bus;
            this.defs = [];
            this.initDom();
            this.updateState();
        }

        initDom() {
            this.element = svg.parseString(`
<svg xmlns="http://www.w3.org/2000/svg" id="svg2" width="112.188" height="299.674">
  <g id="layer1" stroke-linecap="round" stroke-linejoin="round" transform="scale(0.8)">
    <path id="path8212" fill="#0061ff" stroke-width="6.6" d="M.378 44.61v255.064h112.188V44.61H.378z"/>
    <path id="crankbase" fill="#00f" stroke-width="6.6" d="M56.57 88.047C25.328 88.047 0 113.373 0 144.615c.02 22.352 11.807 42.596 32.238 51.66.03 3.318.095 5.24.088 7.938 0 13.947 11.307 25.254 25.254 25.254 13.947 0 25.254-11.307 25.254-25.254-.006-2.986-.415-5.442-.32-8.746 19.487-9.45 30.606-29.195 30.625-50.852 0-31.24-25.33-56.568-56.57-56.568z"/>
    <path id="lowertip" fill="#00a2ff" stroke-width="2" d="M.476 260.78v38.894h53.82v-10.486a6.82 6.566 0 0 1-4.545-6.182 6.82 6.566 0 0 1 6.82-6.566 6.82 6.566 0 0 1 6.82 6.566 6.82 6.566 0 0 1-4.545 6.182v10.486h53.82V260.78H.475z"/>
    <path id="uppertip" fill="#00a2ff" stroke-width="2" d="M112.566 83.503V44.61h-53.82v10.487a6.82 6.566 0 0 1 4.544 6.18 6.82 6.566 0 0 1-6.818 6.568 6.82 6.566 0 0 1-6.82-6.567 6.82 6.566 0 0 1 4.546-6.18V44.61H.378v38.893h112.188z"/>
    <path id="VCC" fill="red" stroke-width="2" d="M53.72 21.93h5.504v22.627H53.72z"/>
    <path id="LOGIC" fill="#fc0" stroke-width="2" d="M47.3 21.93h5.503v22.627H47.3z"/>
    <path id="GND" fill="#a02c2c" stroke-width="2" d="M60.14 21.93h5.505v22.627H60.14z"/>
    <path id="connector" stroke-width="2" d="M45.064 0a1.488 1.488 0 0 0-1.488 1.488v24.5a1.488 1.488 0 0 0 1.488 1.487h22.71a1.488 1.488 0 0 0 1.49-1.488v-24.5A1.488 1.488 0 0 0 67.774 0h-22.71z"/>
    <g id="crank" stroke-width="2" transform="translate(-404.313 -261.25)">
      <path id="arm" fill="#ececec" stroke="#000" d="M462.165 389.752c-10.042 0-18.184 8.14-18.183 18.184 0 10.042 8.14 18.184 18.183 18.183 29.69-.34 169.678 4.973 169.706-16.67.03-21.645-124.41-19.977-169.703-19.7z"/>
      <path id="path8233" fill="#b3b3b3" d="M505.565 395.923c-17.97-.142-34.197.013-45.54.082a6.252 6.252 0 0 1-.04 0c-6.664 0-11.932 5.268-11.932 11.932 0 6.664 5.268 11.932 11.932 11.932 15.364-.175 57.37 1.064 95.746-.34 19.208-.707 37.47-2.1 50.456-4.537 6.493-1.218 11.685-2.76 14.65-4.228 1.31-.65 1.963-1.203 2.323-1.545.003.003.204.176-.517-.41-1.11-.903-3.482-2.186-6.778-3.335-6.592-2.3-16.75-4.23-28.645-5.633-23.79-2.807-54.7-3.706-81.653-3.92z"/>
      <circle id="path8216" cx="460.974" cy="408.037" r="8.972" fill="gray"/>
    </g>
  </g>
</svg>            
            `).firstElementChild as SVGGElement;
            this.crankEl = this.element.querySelector("#crank") as SVGGElement;
            this.crankTransform = this.crankEl.getAttribute("transform");
        }

        moveToCoord(xy: visuals.Coord): void {
            let [x, y] = xy;
            translateEl(this.element, [x, y])
        }
        updateState(): void {
            this.targetAngle = this.state.angle
            if (this.targetAngle != this.currentAngle) {
                const cx = 460.974;
                const cy = 408.037;
                const speed = 600; // 0.1s/60 degree
                const maxdelta = speed * 0.2;
                const delta = this.targetAngle - this.currentAngle;
                this.currentAngle += Math.max(Math.abs(delta), maxdelta) * (delta > 0 ? 1 : -1);
                this.crankEl.setAttribute("transform", this.crankTransform
                    + ` rotate(${this.currentAngle}, ${cx}, ${cy})`)
                runtime.queueDisplayUpdate(); // render animation
            }

        }
        updateTheme(): void {

        }
    }
}
