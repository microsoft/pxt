namespace ks.rt.micro_bit {

    export interface IBoardTheme {
        accent?: string;
        display?: string;
        pin?: string;
        pinTouched?: string;
        pinActive?: string;
        ledOn?: string;
        ledOff?: string;
        buttonOuter?: string;
        buttonUp?: string;
        buttonDown?: string;
    }

    export var themes: IBoardTheme[] = ["#3ADCFE", "#FFD43A", "#3AFFB3", "#FF3A54"].map(accent => {
        return {
            accent: accent,
            display: "#000",
            pin: "#D4AF37",
            pinTouched: "#FFA500",
            pinActive:"#FF5500",
            ledOn: "#ff7f7f",
            ledOff: "#202020",
            buttonOuter: "#979797",
            buttonUp: "#000",
            buttonDown: "#FFA500",
    }});

    export function randomTheme() : IBoardTheme {
        return themes[Math.floor(Math.random() * themes.length)];
    }

    export interface IBoardProps {
        runtime: ks.rt.Runtime;
        theme?: IBoardTheme;
        disableTilt?:boolean;
    }

    class Svg {
		static pt : SVGPoint;
        static cursorPoint(pt: SVGPoint, svg: SVGSVGElement, evt : MouseEvent) : SVGPoint {
          pt.x = evt.clientX; 
          pt.y = evt.clientY;
		  return pt.matrixTransform(svg.getScreenCTM().inverse());
        }
        
        static rotateElement(el : SVGElement, originX : number ,originY : number,degrees:number){
			el.setAttribute(
				'transform',
				`translate(${originX},${originY}) rotate(${degrees+90}) translate(${-originX},${-originY})`
			);
		}
        
                
        static elt(name:string) : SVGElement {        
            return document.createElementNS("http://www.w3.org/2000/svg", name)
        }
        
        static hydrate(el : SVGElement, props: any) {
            Object.keys(props).forEach(k => el.setAttributeNS(null, k, props[k]));        
        }
        
        static child(parent : Element, name: string, props: any) : SVGElement {
            var el = <SVGElement>Svg.elt(name);        
            Svg.hydrate(el, props);
            parent.appendChild(el);
            return el;
        }

        static path(parent: Element, cls: string, data:string) : SVGElement {
            return Svg.child(parent, "path", {class:cls, d:data});
        }           

        static fill(el: SVGElement, c : string) {
            (<SVGStylable><any>el).style.fill = c;
        }
        
        static fills(els: SVGElement[], c : string) {
            els.forEach(el => (<SVGStylable><any>el).style.fill = c);
        }
        
        static buttonEvents(el : Element, 
            move: (ev: MouseEvent) => void, 
            start?: (ev:MouseEvent) => void, 
            stop?: (ev:MouseEvent) => void) {
                let captured = false;
                el.addEventListener('mousedown', (ev: MouseEvent) => {
                    captured = true;
                    if (start) start(ev)
                    return true;
                });
                el.addEventListener('mousemove', (ev:MouseEvent) => {
                    if (captured) {
                        move(ev);
                        ev.preventDefault();
                        return false;
                    }
                    return true;
                });
                el.addEventListener('mouseup', (ev:MouseEvent) => {
                    captured = false;
                    if (stop) stop(ev);
                });
                el.addEventListener('mouseleave', (ev:MouseEvent) => {
                    captured = false;
                    if (stop) stop(ev);
                });
        }
        
        static linearGradient(defs: SVGDefsElement, id : string) : SVGLinearGradientElement {
            let gradient = <SVGLinearGradientElement>Svg.child(defs, "linearGradient", { id: id, x1:"0%", y1:"0%", x2:"0%", y2:"100%" });
            let stop1 = Svg.child(gradient, "stop", {offset:"0%"})
            let stop2 = Svg.child(gradient, "stop", {offset:"100%"})
            let stop3 = Svg.child(gradient, "stop", {offset:"100%"})
            let stop4 = Svg.child(gradient, "stop", {offset:"100%"})
            return gradient;
        }
        
        static animate(el: SVGElement, cls: string) {
            el.classList.add(cls);
            let p = el.parentElement;
            p.removeChild(el);
            p.appendChild(el)
        }
    }

    export class MicrobitBoardSvg
    {
        public element : SVGSVGElement;
        private defs : SVGDefsElement;
        private g: SVGElement;
        
        private logos: SVGElement[];
        private head: SVGGElement; private headInitialized = false;
        private headText: SVGTextElement;
        private display: SVGElement;
        private buttons: SVGElement[];
        private buttonsOuter: SVGElement[];
        private pins: SVGElement[];
        private pinGradients: SVGLinearGradientElement[];
        private pinTexts: SVGTextElement[];
        private ledsOuter: SVGElement[];
        private leds: SVGElement[];
        private systemLed: SVGCircleElement;
        private antenna: SVGPolylineElement;
        public board: rt.micro_bit.Board;        
        
        constructor(public props: IBoardProps) {
            this.board = this.props.runtime.board as rt.micro_bit.Board;
            this.board.updateView = () => this.updateState();
            this.buildDom();              
            this.updateTheme();
            this.updateState();
            this.attachEvents();
        }
                        
        private updateTheme() {
            let theme = this.props.theme;
            
            Svg.fill(this.display, theme.display);
            Svg.fills(this.leds, theme.ledOn);
            Svg.fills(this.ledsOuter, theme.ledOff);
            Svg.fills(this.buttonsOuter, theme.buttonOuter);
            Svg.fills(this.buttons, theme.buttonUp);
            Svg.fills(this.logos, theme.accent);
            
            this.pinGradients.forEach(lg => {
                (<SVGStopElement>lg.childNodes[0]).style.stopColor = theme.pin;
                (<SVGStopElement>lg.childNodes[1]).style.stopColor = theme.pin;
                (<SVGStopElement>lg.childNodes[2]).style.stopColor = theme.pinActive;
                (<SVGStopElement>lg.childNodes[3]).style.stopColor = theme.pinActive;
            })
        }
        
        public updateState() {
            let state = this.board;
            if (!state) return;
            let theme = this.props.theme;
            
            state.buttons.forEach((btn, index) => {
                Svg.fill(this.buttons[index], btn.pressed ? theme.buttonDown : theme.buttonUp);            
            });
            
            var bw =  state.displayMode == rt.micro_bit.DisplayMode.bw         
            var img = state.image;
            this.leds.forEach((led,i) => {
                var sel = (<SVGStylable><any>led)
                sel.style.opacity = ((bw ? img.data[i] > 0 ? 255 : 0 : img.data[i]) / 255.0) + "";
            })
            this.updatePins();
            this.updateTilt();
            this.updateHeading();     
            (<any>this.buttonsOuter[2]).style.visibility = state.usesButtonAB ? 'visible' : 'hidden';   
            (<any>this.buttons[2]).style.visibility = state.usesButtonAB ? 'visible' : 'hidden';   
        }
        
        private updatePin(pin : Pin, index: number) {
            if (!pin) return;
            let text = this.pinTexts[index];
            let v = '';
            if (pin.mode & PinMode.Analog) {
                v = Math.floor(100 - (pin.value || 0) / 1023 * 100) + '%';
                if(text) text.textContent = (pin.value || 0) + "";
            }
            else if (pin.mode & PinMode.Digital) {
                v = pin.value > 0 ? '0%' : '100%';
                if (text) text.textContent = pin.value > 0 ? "1" : "0";
            }
            else if (pin.mode & PinMode.Touch) {
                v = pin.touched ? '0%' : '100%';
                if (text) text.textContent = "";
            }
            if (v) {
                let lg = this.pinGradients[index];
                (<SVGStopElement>lg.childNodes[1]).setAttribute("offset", v);
                (<SVGStopElement>lg.childNodes[2]).setAttribute("offset", v);                
            }
        }
        
        private updateHeading() {
            let xc = 258;
            let yc = 75;
            let state = this.board;
            if (!state || !state.usesHeading) return;
            if (!this.headInitialized) {
                let p = this.head.firstChild.nextSibling as SVGPathElement;
                p.setAttribute("d", "m269.9,50.134647l0,0l-39.5,0l0,0c-14.1,0.1 -24.6,10.7 -24.6,24.8c0,13.9 10.4,24.4 24.3,24.7l0,0l39.6,0c14.2,0 40.36034,-22.97069 40.36034,-24.85394c0,-1.88326 -26.06034,-24.54606 -40.16034,-24.64606m-0.2,39l0,0l-39.3,0c-7.7,-0.1 -14,-6.4 -14,-14.2c0,-7.8 6.4,-14.2 14.2,-14.2l39.1,0c7.8,0 14.2,6.4 14.2,14.2c0,7.9 -6.4,14.2 -14.2,14.2l0,0l0,0z");
                let pt = this.element.createSVGPoint();
                Svg.buttonEvents(
                    this.head,
                    (ev : MouseEvent) => {
                            let cur = Svg.cursorPoint(pt, this.element, ev);
                            state.heading = Math.floor(Math.atan2(cur.y - yc, cur.x - xc) * 180 / Math.PI+90);
                            if (state.heading < 0) state.heading += 360;
                            console.log('heading: ' + state.heading)
                            this.updateHeading();
                    });
                this.headInitialized = true;
            }
            
            let txt = state.heading.toString() + '°';
            if (txt != this.headText.textContent) {                
                Svg.rotateElement(this.head, xc, yc, state.heading+180);
                this.headText.textContent = txt;
            }            
        }
        
        private lastFlashTime : number = 0;
        public flashSystemLed() {
            if (!this.systemLed)
                this.systemLed = <SVGCircleElement>Svg.child(this.g, "circle", {class:"sim-systemled", cx:300, cy:20, r:5})
            let now = Date.now();
            if (now - this.lastFlashTime > 150) {
                this.lastFlashTime = now;
                Svg.animate(this.systemLed, 'sim-flash')
            }
        }
        
        private lastAntennaFlash : number = 0;
        public flashAntenna() {
            if (!this.antenna) {            
                let ax = 380;
                let dax = 18;
                let ayt = 10;
                let ayb = 40;
                this.antenna = <SVGPolylineElement>Svg.child(this.g, "polyline", { class:"sim-antenna", points: `${ax},${ayb} ${ax},${ayt} ${ax+=dax},${ayt} ${ax},${ayb} ${ax+=dax},${ayb} ${ax},${ayt} ${ax+=dax},${ayt} ${ax},${ayb} ${ax+=dax},${ayb} ${ax},${ayt} ${ax+=dax},${ayt}`})                
            }
            let now = Date.now();
            if (now - this.lastAntennaFlash > 200) {
                this.lastAntennaFlash = now;
                Svg.animate(this.antenna, 'sim-flash-stroke')
            }
        }
        
        private updatePins() {
            let state = this.board;
            if (!state) return;
            
            state.pins.forEach((pin,i) => this.updatePin(pin,i));            
        }        
        
        private updateTilt() {
            if (this.props.disableTilt) return;
            let state = this.board;
            if (!state || !state.usesAcceleration) return;

            var acc = state.acceleration;        
            var af = 8 / 1023;
            if(acc && !isNaN(acc[0]) && !isNaN(acc[1])) {
                this.element.style.transform = "perspective(30em) rotateX(" + -acc[1]*af + "deg) rotateY(" + acc[0]*af +"deg)"
                this.element.style.perspectiveOrigin = "50% 50% 50%";
                this.element.style.perspective = "30em";            
            }        
        }
        
        private buildDom() {
            this.element = <SVGSVGElement>Svg.elt("svg")
            Svg.hydrate(this.element, {
                "version": "1.0",            
                "viewBox": "0 0 498 406",
                "enable-background": "new 0 0 498 406",
                "class":"sim",
                "x": "0px",
                "y": "0px"});
            this.defs = <SVGDefsElement>Svg.child(this.element, "defs", {});
            this.g = Svg.elt("g");
            this.element.appendChild(this.g);
    
            // outline
            Svg.path(this.g, "sim-board", "M498,31.9C498,14.3,483.7,0,466.1,0H31.9C14.3,0,0,14.3,0,31.9v342.2C0,391.7,14.3,406,31.9,406h434.2c17.6,0,31.9-14.3,31.9-31.9V31.9z M14.3,206.7c-2.7,0-4.8-2.2-4.8-4.8c0-2.7,2.2-4.8,4.8-4.8c2.7,0,4.8,2.2,4.8,4.8C19.2,204.6,17,206.7,14.3,206.7z M486.2,206.7c-2.7,0-4.8-2.2-4.8-4.8c0-2.72.2-4.8,4.8-4.8c2.7,0,4.8,2.2,4.8,4.8C491,204.6,488.8,206.7,486.2,206.7z");       

            // script background
            this.display = Svg.path(this.g, "sim-display", "M333.8,310.3H165.9c-8.3,0-15-6.7-15-15V127.5c0-8.3,6.7-15,15-15h167.8c8.3,0,15,6.7,15,15v167.8C348.8,303.6,342.1,310.3,333.8,310.3z");

            this.logos = [];
            this.logos.push(Svg.child(this.g, "polygon", {class:"sim-theme", points:"115,56.7 173.1,0 115,0"}));      
            this.logos.push(Svg.path(this.g, "sim-theme", "M114.2,0H25.9C12.1,2.1,0,13.3,0,27.7v83.9L114.2,0z"));
            this.logos.push(Svg.child(this.g, "polygon", {class:"sim-theme", points:"173,27.9 202.5,0 173,0"}));      
            this.logos.push(Svg.child(this.g, "polygon", {class:"sim-theme", points:"54.1,242.4 54.1,274.1 22.4,274.1"}));      
            this.logos.push(Svg.child(this.g, "polygon", {class:"sim-theme", points:"446.2,164.6 446.2,132.8 477.9,132.8"}));      
                        
            // leds
            this.leds = [];
            this.ledsOuter = [];
            var left = 154, top = 113, ledoffw = 46, ledoffh = 44;
            for (var i = 0; i < 5; ++i) {
                var ledtop = i * ledoffh + top;
                for (var j = 0; j < 5; ++j) {
                    var ledleft = j * ledoffw + left;
                    var k = i * 5 + j;
                    this.ledsOuter.push(Svg.child(this.g, "rect", { class:"sim-led-back", x:ledleft, y:ledtop, width:10, height:20, rx:2, ry:2 }));
                    this.leds.push(Svg.child(this.g, "rect", { class:"sim-led", x:ledleft-2, y:ledtop-2, width:14, height:24, rx:2, ry:2})); 
                }
            }
                        
            // head
            this.head = <SVGGElement>Svg.child(this.g, "g", {});
            Svg.child(this.head, "circle", { cx: 258, cy: 75, r: 100, fill:'transparent'})
            this.logos.push(Svg.path(this.head, "sim-theme","M269.9,50.2L269.9,50.2l-39.5,0v0c-14.1,0.1-24.6,10.7-24.6,24.8c0,13.9,10.4,24.4,24.3,24.7v0h39.6c14.2,0,24.8-10.6,24.8-24.7C294.5,61,284,50.3,269.9,50.2 M269.7,89.2L269.7,89.2l-39.3,0c-7.7-0.1-14-6.4-14-14.2c0-7.8,6.4-14.2,14.2-14.2h39.1c7.8,0,14.2,6.4,14.2,14.2C283.9,82.9,277.5,89.2,269.7,89.2"));
            this.logos.push(Svg.path(this.head, "sim-theme","M230.6,69.7c-2.9,0-5.3,2.4-5.3,5.3c0,2.9,2.4,5.3,5.3,5.3c2.9,0,5.3-2.4,5.3-5.3C235.9,72.1,233.5,69.7,230.6,69.7"));
            this.logos.push(Svg.path(this.head, "sim-theme","M269.7,80.3c2.9,0,5.3-2.4,5.3-5.3c0-2.9-2.4-5.3-5.3-5.3c-2.9,0-5.3,2.4-5.3,5.3C264.4,77.9,266.8,80.3,269.7,80.3"));
            this.headText = <SVGTextElement>Svg.child(this.g, "text", { x: 310, y: 100, class:'sim-text' })
            
            // P0, P1, P2
            this.pins = [
                "M16.5,341.2c0,0.4-0.1,0.9-0.1,1.3v60.7c4.1,1.7,8.6,2.7,12.9,2.7h34.4v-64.7h0.3c0,0,0-0.1,0-0.1c0-13-10.6-23.6-23.7-23.6C27.2,317.6,16.5,328.1,16.5,341.2z M21.2,341.6c0-10.7,8.7-19.3,19.3-19.3c10.7,0,19.3,8.7,19.3,19.3c0,10.7-8.6,19.3-19.3,19.3C29.9,360.9,21.2,352.2,21.2,341.6z",
                "M139.1,317.3c-12.8,0-22.1,10.3-23.1,23.1V406h46.2v-65.6C162.2,327.7,151.9,317.3,139.1,317.3zM139.3,360.1c-10.7,0-19.3-8.6-19.3-19.3c0-10.7,8.6-19.3,19.3-19.3c10.7,0,19.3,8.7,19.3,19.3C158.6,351.5,150,360.1,139.3,360.1z",
                "M249,317.3c-12.8,0-22.1,10.3-23.1,23.1V406h46.2v-65.6C272.1,327.7,261.8,317.3,249,317.3z M249.4,360.1c-10.7,0-19.3-8.6-19.3-19.3c0-10.7,8.6-19.3,19.3-19.3c10.7,0,19.3,8.7,19.3,19.3C268.7,351.5,260.1,360.1,249.4,360.1z"
            ].map(p => Svg.path(this.g, "sim-pin sim-pin-touch", p));

            // side pins
            this.pins.push(Svg.path(this.g, "sim-pin", "M0,357.7v19.2c0,10.8,6.2,20.2,14.4,25.2v-44.4H0z"));
            this.pins.push(Svg.path(this.g, "sim-pin", "M483.6,402c8.2-5,14.4-14.4,14.4-25.1v-19.2h-14.4V402z"));

            [66.7,79.1,91.4,103.7,164.3,176.6,188.9,201.3,213.6,275.2,287.5,299.8,312.1,324.5,385.1,397.4,409.7,422].forEach(x => {
                this.pins.push(Svg.child(this.g, "rect", {x:x, y:356.7, width:10, height:50}));
            })
            
            this.pins.push(Svg.path(this.g, "sim-pin", "M359.9,317.3c-12.8,0-22.1,10.3-23.1,23.1V406H383v-65.6C383,327.7,372.7,317.3,359.9,317.3z M360,360.1c-10.7,0-19.3-8.6-19.3-19.3c0-10.7,8.6-19.3,19.3-19.3c10.7,0,19.3,8.7,19.3,19.3C379.3,351.5,370.7,360.1,360,360.1z"));
            this.pins.push(Svg.path(this.g, "sim-pin", "M458,317.6c-13,0-23.6,10.6-23.6,23.6c0,0,0,0.1,0,0.1h0V406H469c4.3,0,8.4-1,12.6-2.7v-60.7c0-0.4,0-0.9,0-1.3C481.6,328.1,471,317.6,458,317.6z M457.8,360.9c-10.7,0-19.3-8.6-19.3-19.3c0-10.7,8.6-19.3,19.3-19.3c10.7,0,19.3,8.7,19.3,19.3C477.1,352.2,468.4,360.9,457.8,360.9z"));
            
            this.pinGradients = this.pins.map((pin,i) => {
                let gid= "gradient-pin-" + i
                let lg = Svg.linearGradient(this.defs, gid) 
                pin.setAttribute("fill", `url(#${gid})`);
                return lg;
            })
            
            this.pinTexts = [67,165,275].map(x => <SVGTextElement>Svg.child(this.g, "text", { class:'sim-text-pin', x:x, y:345 }));

            this.buttonsOuter = []; this.buttons = [];
            this.buttonsOuter.push(Svg.path(this.g, "sim-button-outer", "M82.1,232.6H25.9c-0.5,0-1-0.4-1-1v-56.2c0-0.5,0.4-1,1-1h56.2c0.5,0,1,0.4,1,1v56.2C83,232.2,82.6,232.6,82.1,232.6"));
            this.buttons.push(Svg.path(this.g, "sim-button", "M69.7,203.5c0,8.7-7,15.7-15.7,15.7s-15.7-7-15.7-15.7c0-8.7,7-15.7,15.7-15.7S69.7,194.9,69.7,203.5"));
            this.buttonsOuter.push(Svg.path(this.g, "sim-button-outer", "M474.3,232.6h-56.2c-0.5,0-1-0.4-1-1v-56.2c0-0.5,0.4-1,1-1h56.2c0.5,0,1,0.4,1,1v56.2C475.3,232.2,474.8,232.6,474.3,232.6"));
            this.buttons.push(Svg.path(this.g, "sim-button", "M461.9,203.5c0,8.7-7,15.7-15.7,15.7c-8.7,0-15.7-7-15.7-15.7c0-8.7,7-15.7,15.7-15.7C454.9,187.8,461.9,194.9,461.9,203.5"));        
            this.buttonsOuter.push(Svg.child(this.g, "rect", {class:"sim-button-outer", x:417, y:250, width:58, height:58, rx:1, ry:1}));
            this.buttons.push(Svg.child(this.g, "circle", {class:"sim-button", cx:446, cy:278, r:16.5}));
            (<any>this.buttonsOuter[2]).style.visibility = 'hidden';
            (<any>this.buttons[2]).style.visibility = 'hidden';
            
                    
            Svg.path(this.g, "sim-label", "M35.7,376.4c0-2.8,2.1-5.1,5.5-5.1c3.3,0,5.5,2.4,5.5,5.1v4.7c0,2.8-2.2,5.1-5.5,5.1c-3.3,0-5.5-2.4-5.5-5.1V376.4zM43.3,376.4c0-1.3-0.8-2.3-2.2-2.3c-1.3,0-2.1,1.1-2.1,2.3v4.7c0,1.2,0.8,2.3,2.1,2.3c1.3,0,2.2-1.1,2.2-2.3V376.4z");
            Svg.path(this.g, "sim-label", "M136.2,374.1c2.8,0,3.4-0.8,3.4-2.5h2.9v14.3h-3.4v-9.5h-3V374.1z");
            Svg.path(this.g, "sim-label", "M248.6,378.5c1.7-1,3-1.7,3-3.1c0-1.1-0.7-1.6-1.6-1.6c-1,0-1.8,0.6-1.8,2.1h-3.3c0-2.6,1.8-4.6,5.1-4.6c2.6,0,4.9,1.3,4.9,4.3c0,2.4-2.3,3.9-3.8,4.7c-2,1.3-2.5,1.8-2.5,2.9h6.1v2.7h-10C244.8,381.2,246.4,379.9,248.6,378.5z");
            Svg.path(this.g, "sim-label", "M48.1,270.9l-0.6-1.7h-5.1l-0.6,1.7h-3.5l5.1-14.3h3.1l5.2,14.3H48.1z M45,260.7l-1.8,5.9h3.5L45,260.7z");

            Svg.path(this.g, "sim-label", "M449.1,135.8h5.9c3.9,0,4.7,2.4,4.7,3.9c0,1.8-1.4,2.9-2.5,3.2c0.9,0,2.6,1.1,2.6,3.3c0,1.5-0.8,4-4.7,4h-6V135.8zM454.4,141.7c1.6,0,2-1,2-1.7c0-0.6-0.3-1.7-2-1.7h-2v3.4H454.4z M452.4,144.1v3.5h2.1c1.6,0,2-1,2-1.8c0-0.7-0.4-1.8-2-1.8H452.4z")
            Svg.path(this.g, "sim-label", "M352.1,381.1c0,1.6,0.9,2.5,2.2,2.5c1.2,0,1.9-0.9,1.9-1.9c0-1.2-0.6-2-2.1-2h-1.3v-2.6h1.3c1.5,0,1.9-0.7,1.9-1.8c0-1.1-0.7-1.6-1.6-1.6c-1.4,0-1.8,0.8-1.8,2.1h-3.3c0-2.4,1.5-4.6,5.1-4.6c2.6,0,5,1.3,5,4c0,1.6-1,2.8-2.1,3.2c1.3,0.5,2.3,1.6,2.3,3.5c0,2.7-2.4,4.3-5.2,4.3c-3.5,0-5.5-2.1-5.5-5.1H352.1z")
            Svg.path(this.g, "sim-label", "M368.5,385.9h-3.1l-5.1-14.3h3.5l3.1,10.1l3.1-10.1h3.6L368.5,385.9z")
            Svg.path(this.g, "sim-label", "M444.4,378.3h7.4v2.5h-1.5c-0.6,3.3-3,5.5-7.1,5.5c-4.8,0-7.5-3.5-7.5-7.5c0-3.9,2.8-7.5,7.5-7.5c3.8,0,6.4,2.3,6.6,5h-3.5c-0.2-1.1-1.4-2.2-3.1-2.2c-2.7,0-4.1,2.3-4.1,4.7c0,2.5,1.4,4.7,4.4,4.7c2,0,3.2-1.2,3.4-2.7h-2.5V378.3z")
            Svg.path(this.g, "sim-label", "M461.4,380.9v-9.3h3.3v14.3h-3.5l-5.2-9.2v9.2h-3.3v-14.3h3.5L461.4,380.9z")
            Svg.path(this.g, "sim-label", "M472.7,371.6c4.8,0,7.5,3.5,7.5,7.2s-2.7,7.2-7.5,7.2h-5.3v-14.3H472.7z M470.8,374.4v8.6h1.8c2.7,0,4.2-2.1,4.2-4.3s-1.6-4.3-4.2-4.3H470.8z")    
        }
        
        private attachEvents() {
            Runtime.messagePosted = (msg) => {
                switch(msg.type || '') {
                    case 'serial': this.flashSystemLed(); break;
                    case 'radiopacket': this.flashAntenna(); break;
                }
            }
            this.element.addEventListener("mousemove", (ev: MouseEvent) => {
                let state = this.board;
                if (!state.acceleration) return;            
                let ax = (ev.clientX - this.element.clientWidth / 2) / (this.element.clientWidth / 3);
                let ay = (ev.clientY - this.element.clientHeight / 2) / (this.element.clientHeight / 3);
                state.acceleration[0] = Math.max(-1023, Math.min(1023, Math.floor(ax * 1023)));
                state.acceleration[1] = Math.max(-1023, Math.min(1023, Math.floor(ay * 1023)));
                state.acceleration[2] = Math.floor(Math.sqrt(1023*1023
                    - state.acceleration[0] *state.acceleration[0] 
                    - state.acceleration[1] *state.acceleration[1]));
                this.updateTilt();
            }, false);
            this.element.addEventListener("mouseleave", (ev: MouseEvent) => {
                let state = this.board;
                if (!state.acceleration) return;
                
                state.acceleration[0] = 0;
                state.acceleration[1] = 0;
                state.acceleration[2] = -1023;
                this.updateTilt();
            }, false);
            
            this.pins.forEach((pin, index) => {
                if (!this.board.pins[index]) return;
                let pt = this.element.createSVGPoint();
                Svg.buttonEvents(pin,
                    // move
                    ev => {
                        let state = this.board;
                        let pin = state.pins[index];
                        let svgpin = this.pins[index];
                        if (pin.mode & PinMode.Input) {
                            let cursor = Svg.cursorPoint(pt, this.element, ev);
                            let v = (400 - cursor.y) / 40 * 1023
                            pin.value = Math.max(0, Math.min(1023, Math.floor(v)));
                        }
                        this.updatePin(pin,index);
                    },
                    // start
                    ev => {
                        let state = this.board;
                        let pin = state.pins[index];
                        let svgpin = this.pins[index];
                        svgpin.classList.add('touched');                            
                        if (pin.mode & PinMode.Touch) {
                            pin.touched = true;
                        } else if (pin.mode & PinMode.Input) {
                            let cursor = Svg.cursorPoint(pt, this.element, ev);
                            let v = (400 - cursor.y) / 40 * 1023
                            pin.value = Math.max(0, Math.min(1023, Math.floor(v)));
                        }
                        this.updatePin(pin,index);
                    },
                    // stop
                    (ev: MouseEvent) => {
                        let state = this.board;
                        let pin = state.pins[index];
                        let svgpin = this.pins[index];
                        svgpin.classList.remove('touched');
                        if (pin.mode & PinMode.Touch) {                        
                            pin.touched = false;
                            let ens = enums();
                            this.board.bus.queue(pin.id, ens.MICROBIT_BUTTON_EVT_CLICK);
                        }
                        this.updatePin(pin, index);
                        return false;
                });
            })
            this.buttonsOuter.slice(0,2).forEach((btn, index) => {
                btn.addEventListener("mousedown", ev => {
                    let state = this.board;
                    state.buttons[index].pressed = true;
                    Svg.fill(this.buttons[index], this.props.theme.buttonDown);          
                })
                btn.addEventListener("mouseup", ev => {
                    let state = this.board;
                    state.buttons[index].pressed = false;
                    Svg.fill(this.buttons[index], this.props.theme.buttonUp);
                    
                    let ens = enums();
                    this.board.bus.queue(state.buttons[index].id, ens.MICROBIT_BUTTON_EVT_CLICK);
                })
            })
            this.buttonsOuter[2].addEventListener("mousedown", ev => {
                    let state = this.board;
                    state.buttons[0].pressed = true;
                    state.buttons[1].pressed = true;
                    state.buttons[2].pressed = true;
                    Svg.fill(this.buttons[0], this.props.theme.buttonDown);                
                    Svg.fill(this.buttons[1], this.props.theme.buttonDown);                
                    Svg.fill(this.buttons[2], this.props.theme.buttonDown);                
                })
            this.buttonsOuter[2].addEventListener("mouseup", ev => {
                    let state = this.board;
                    state.buttons[0].pressed = false;
                    state.buttons[1].pressed = false;
                    state.buttons[2].pressed = false;
                    Svg.fill(this.buttons[0], this.props.theme.buttonUp);                
                    Svg.fill(this.buttons[1], this.props.theme.buttonUp);                
                    Svg.fill(this.buttons[2], this.props.theme.buttonUp);                
                    
                    let ens = enums();
                    this.board.bus.queue(state.buttons[2].id, ens.MICROBIT_BUTTON_EVT_CLICK);
            })        
        }
    }
}