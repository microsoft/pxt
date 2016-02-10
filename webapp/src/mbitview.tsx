import * as React from "react";
import * as ReactDOM from "react-dom";

export interface IMbitFont {
    chars: Util.StringMap<number[]>;
}

export enum MbitDisplayMode {
    bw,
    greyscale
}

export interface IMbitBoard {
    id?: string;

    // display
    image?: number[];
    brigthness?: number;
    displayMode?: MbitDisplayMode
    font?: IMbitFont;

    // buttons    
    buttonAPressed?: boolean;
    buttonBPressed?: boolean;
    buttonABPressed?: boolean;

    // pins
    P0Touched?: boolean;
    P1Touched?: boolean;
    P2Touched?: boolean;

    // sensors    
    acceleration?: number[];
    heading?: number;
    temperature?: number;
    lightLevel?: number;
}

export interface IMbitTheme {
    accent?: string;
    display?: string;
    pin?: string;
    pinTouched?: string;
    ledOn?: string;
    ledOff?: string;
    buttonOuter?: string;
    buttonUp?: string;
    buttonDown?: string;

    pinOn?: string;
    pinOff?: string;
}

export function createBoard(id?: string): IMbitBoard {
    return {
        id: id || ("b" + Math.random()),
        brigthness: 255,
        displayMode: MbitDisplayMode.bw,
        image: [
            0, 255, 0, 255, 0,
            255, 0, 255, 0, 255,
            255, 0, 0, 0, 255,
            0, 255, 0, 255, 0,
            0, 0, 255, 0, 0,
        ],
        acceleration: [0,0,-1023],
        heading:90,
        temperature: 21
    }
}

/*
"#3ADCFE",
"#FFD43A",
"#3AFFB3",
"#FF3A54"
*/
export var themes: Util.StringMap<IMbitTheme> = {
    "blue": {
        accent: "#3ADCFE",
        display: "#000",
        pin: "#D4AF37",
        pinTouched: "#FFA500",
        ledOn: "#ff7f7f",
        ledOff: "#202020",
        buttonOuter: "#979797",
        buttonUp: "#000",
        buttonDown: "#FFA500",
    },
}

export interface IMbitBoardProps {
    theme?: IMbitTheme;
}

export class MbitRuntime extends rt.Runtime {
    constructor(code:string) {
        super(code)
    }
}

export class MbitBoardView extends React.Component<IMbitBoardProps, IMbitBoard> {
    constructor(props: IMbitBoardProps) {
        super(props);
        this.state = createBoard();
    }

    render() {
        let theme = this.props.theme;
        var leds: any[] = [];
        var image = this.state.image;
        var brightness = this.state.brigthness / 255;
        var mode = this.state.displayMode;
        var left = 154, top = 113, ledoffw = 46, ledoffh = 44;
        for (var i = 0; i < 5; ++i) {
            var ledtop = i * ledoffh + top;
            for (var j = 0; j < 5; ++j) {
                var ledleft = j * ledoffw + left;
                var k = i * 5 + j;
                leds.push(<rect className="sim-led-back" key={"ledb" + i + "-" + j} x={ledleft} y={ledtop} width="10" height="20" rx="2" ry="2" fill={theme.ledOff} />)
                if (image[k] > 0)
                    leds.push(<rect key={"led" + i + "-" + j} x={ledleft - 2} y={ledtop - 2} width="14" height="24" rx="2" ry="2" fill={theme.ledOn} 
                        className="sim-led " 
                        opacity={(mode == MbitDisplayMode.bw ? (image[k] > 0 ? 255 : 0) : image[k])*brightness/255} 
                        />)
            }
        }
        
        var af = 10 / 1023;
        var style : React.CSSProperties = {}
        var acc = this.state.acceleration;
        if(acc) {
            style.transform = "perspective(30em) rotateX(" + -acc[1]*af + "deg) rotateY(" + acc[0]*af +"deg)"
            style.perspectiveOrigin = "50% 50% 50%";
            style.perspective = "30em";            
        }

        return (
            <div>
            <svg version="1.1" x="0px" y="0px" viewBox="0 0 498 406" enable-background="new 0 0 498 406"
                style={style}>
                <g>
                    <path d="M498,31.9C498,14.3,483.7,0,466.1,0H31.9C14.3,0,0,14.3,0,31.9v342.2C0,391.7,14.3,406,31.9,406h434.2c17.6,0,31.9-14.3,31.9-31.9V31.9z M14.3,206.7c-2.7,0-4.8-2.2-4.8-4.8c0-2.7,2.2-4.8,4.8-4.8c2.7,0,4.8,2.2,4.8,4.8C19.2,204.6,17,206.7,14.3,206.7z M486.2,206.7c-2.7,0-4.8-2.2-4.8-4.8c0-2.72.2-4.8,4.8-4.8c2.7,0,4.8,2.2,4.8,4.8C491,204.6,488.8,206.7,486.2,206.7z" />
                    <path className="sim-pin" fill={theme.pin} d="M0,357.7v19.2c0,10.8,6.2,20.2,14.4,25.2v-44.4H0z"/>
                    <path className="sim-pin" fill={theme.pin} d="M483.6,402c8.2-5,14.4-14.4,14.4-25.1v-19.2h-14.4V402z"/>
                    <rect className="sim-pin" fill={theme.pin} x="66.7" y="356.7" width="9.2" height="49.3"/>
                    <rect className="sim-pin" fill={theme.pin} x="79.1" y="356.7" width="9.2" height="49.3"/>
                    <rect className="sim-pin" fill={theme.pin} x="91.4" y="356.7" width="9.2" height="49.3"/>
                    <rect className="sim-pin" fill={theme.pin} x="103.7" y="356.7" width="9.2" height="49.3"/>
                    <rect className="sim-pin" fill={theme.pin} x="164.3" y="356.7" width="10.3" height="49.3"/>
                    <rect className="sim-pin" fill={theme.pin} x="176.6" y="356.7" width="10.3" height="49.3"/>
                    <rect className="sim-pin" fill={theme.pin} x="188.9" y="356.7" width="10.3" height="49.3"/>
                    <rect className="sim-pin" fill={theme.pin} x="201.3" y="356.7" width="10.3" height="49.3"/>
                    <rect className="sim-pin" fill={theme.pin} x="213.6" y="356.7" width="10.3" height="49.3"/>
                    <rect className="sim-pin" fill={theme.pin} x="275.2" y="356.7" width="9.2" height="49.3"/>
                    <rect className="sim-pin" fill={theme.pin} x="287.5" y="356.7" width="9.2" height="49.3"/>
                    <rect className="sim-pin" fill={theme.pin} x="299.8" y="356.7" width="9.2" height="49.3"/>
                    <rect className="sim-pin" fill={theme.pin} x="312.1" y="356.7" width="9.2" height="49.3"/>
                    <rect className="sim-pin" fill={theme.pin} x="324.5" y="356.7" width="9.2" height="49.3"/>
                    <rect className="sim-pin" fill={theme.pin} x="385.1" y="356.7" width="10.3" height="49.3"/>
                    <rect className="sim-pin" fill={theme.pin} x="397.4" y="356.7" width="10.3" height="49.3"/>
                    <rect className="sim-pin" fill={theme.pin} x="409.7" y="356.7" width="10.3" height="49.3"/>
                    <rect className="sim-pin" fill={theme.pin} x="422" y="356.7" width="10.3" height="49.3"/>
                    <path className="sim-pin sim-pin-touch" d="M139.1,317.3c-12.8,0-22.1,10.3-23.1,23.1V406h46.2v-65.6C162.2,327.7,151.9,317.3,139.1,317.3zM139.3,360.1c-10.7,0-19.3-8.6-19.3-19.3c0-10.7,8.6-19.3,19.3-19.3c10.7,0,19.3,8.7,19.3,19.3C158.6,351.5,150,360.1,139.3,360.1z"
                        fill={this.state.P1Touched ? theme.pinTouched : theme.pin}
                        onMouseDown={ev => this.setState({ P1Touched: true }) }
                        onMouseUp={ev => this.setState({ P1Touched: false }) }
                        />
                    <path className="sim-pin sim-pin-touch" d="M249,317.3c-12.8,0-22.1,10.3-23.1,23.1V406h46.2v-65.6C272.1,327.7,261.8,317.3,249,317.3z M249.4,360.1c-10.7,0-19.3-8.6-19.3-19.3c0-10.7,8.6-19.3,19.3-19.3c10.7,0,19.3,8.7,19.3,19.3C268.7,351.5,260.1,360.1,249.4,360.1z"
                        fill={this.state.P2Touched ? theme.pinTouched : theme.pin}
                        onMouseDown={ev => this.setState({ P2Touched: true }) }
                        onMouseUp={ev => this.setState({ P2Touched: false }) }
                        />
                    <path className="sim-pin" fill={theme.pin} d="M359.9,317.3c-12.8,0-22.1,10.3-23.1,23.1V406H383v-65.6C383,327.7,372.7,317.3,359.9,317.3z M360,360.1c-10.7,0-19.3-8.6-19.3-19.3c0-10.7,8.6-19.3,19.3-19.3c10.7,0,19.3,8.7,19.3,19.3C379.3,351.5,370.7,360.1,360,360.1z"/>
                    <path className="sim-pin" fill={theme.pin} d="M458,317.6c-13,0-23.6,10.6-23.6,23.6c0,0,0,0.1,0,0.1h0V406H469c4.3,0,8.4-1,12.6-2.7v-60.7c0-0.4,0-0.9,0-1.3C481.6,328.1,471,317.6,458,317.6z M457.8,360.9c-10.7,0-19.3-8.6-19.3-19.3c0-10.7,8.6-19.3,19.3-19.3c10.7,0,19.3,8.7,19.3,19.3C477.1,352.2,468.4,360.9,457.8,360.9z"/>
                    <path className="sim-pin sim-pin-touch" d="M16.5,341.2c0,0.4-0.1,0.9-0.1,1.3v60.7c4.1,1.7,8.6,2.7,12.9,2.7h34.4v-64.7h0.3c0,0,0-0.1,0-0.1c0-13-10.6-23.6-23.7-23.6C27.2,317.6,16.5,328.1,16.5,341.2z M21.2,341.6c0-10.7,8.7-19.3,19.3-19.3c10.7,0,19.3,8.7,19.3,19.3c0,10.7-8.6,19.3-19.3,19.3C29.9,360.9,21.2,352.2,21.2,341.6z"
                        fill={this.state.P0Touched ? theme.pinTouched : theme.pin}
                        onMouseDown={ev => this.setState({ P0Touched: true }) }
                        onMouseUp={ev => this.setState({ P0Touched: false }) }
                        />
                    <polygon className="sim-theme" fill={theme.accent} points="115,56.7 173.1,0 115,0"/>
                    <path className="sim-theme" fill={theme.accent} d="M114.2,0H25.9C12.1,2.1,0,13.3,0,27.7v83.9L114.2,0z"/>
                    <polygon className="sim-theme" fill={theme.accent} points="173,27.9 202.5,0 173,0 		"/>
                    <path d="M35.7,376.4c0-2.8,2.1-5.1,5.5-5.1c3.3,0,5.5,2.4,5.5,5.1v4.7c0,2.8-2.2,5.1-5.5,5.1c-3.3,0-5.5-2.4-5.5-5.1V376.4zM43.3,376.4c0-1.3-0.8-2.3-2.2-2.3c-1.3,0-2.1,1.1-2.1,2.3v4.7c0,1.2,0.8,2.3,2.1,2.3c1.3,0,2.2-1.1,2.2-2.3V376.4z"/>
                    <path d="M136.2,374.1c2.8,0,3.4-0.8,3.4-2.5h2.9v14.3h-3.4v-9.5h-3V374.1z"/>
                    <path d="M248.6,378.5c1.7-1,3-1.7,3-3.1c0-1.1-0.7-1.6-1.6-1.6c-1,0-1.8,0.6-1.8,2.1h-3.3c0-2.6,1.8-4.6,5.1-4.6c2.6,0,4.9,1.3,4.9,4.3c0,2.4-2.3,3.9-3.8,4.7c-2,1.3-2.5,1.8-2.5,2.9h6.1v2.7h-10C244.8,381.2,246.4,379.9,248.6,378.5z"/>
                    <polygon className="sim-theme" fill={theme.accent} points="54.1,242.4 54.1,274.1 22.4,274.1 	"/>
                    <path d="M48.1,270.9l-0.6-1.7h-5.1l-0.6,1.7h-3.5l5.1-14.3h3.1l5.2,14.3H48.1z M45,260.7l-1.8,5.9h3.5L45,260.7z"/>
                    <polygon className="sim-theme" fill={theme.accent} points="446.2,164.6 446.2,132.8 477.9,132.8 	"/>
                    <path d="M449.1,135.8h5.9c3.9,0,4.7,2.4,4.7,3.9c0,1.8-1.4,2.9-2.5,3.2c0.9,0,2.6,1.1,2.6,3.3c0,1.5-0.8,4-4.7,4h-6V135.8zM454.4,141.7c1.6,0,2-1,2-1.7c0-0.6-0.3-1.7-2-1.7h-2v3.4H454.4z M452.4,144.1v3.5h2.1c1.6,0,2-1,2-1.8c0-0.7-0.4-1.8-2-1.8H452.4z"/>
                    <path d="M352.1,381.1c0,1.6,0.9,2.5,2.2,2.5c1.2,0,1.9-0.9,1.9-1.9c0-1.2-0.6-2-2.1-2h-1.3v-2.6h1.3c1.5,0,1.9-0.7,1.9-1.8c0-1.1-0.7-1.6-1.6-1.6c-1.4,0-1.8,0.8-1.8,2.1h-3.3c0-2.4,1.5-4.6,5.1-4.6c2.6,0,5,1.3,5,4c0,1.6-1,2.8-2.1,3.2c1.3,0.5,2.3,1.6,2.3,3.5c0,2.7-2.4,4.3-5.2,4.3c-3.5,0-5.5-2.1-5.5-5.1H352.1z"/>
                    <path d="M368.5,385.9h-3.1l-5.1-14.3h3.5l3.1,10.1l3.1-10.1h3.6L368.5,385.9z"/>
                    <path d="M444.4,378.3h7.4v2.5h-1.5c-0.6,3.3-3,5.5-7.1,5.5c-4.8,0-7.5-3.5-7.5-7.5c0-3.9,2.8-7.5,7.5-7.5c3.8,0,6.4,2.3,6.6,5h-3.5c-0.2-1.1-1.4-2.2-3.1-2.2c-2.7,0-4.1,2.3-4.1,4.7c0,2.5,1.4,4.7,4.4,4.7c2,0,3.2-1.2,3.4-2.7h-2.5V378.3z"/>
                    <path d="M461.4,380.9v-9.3h3.3v14.3h-3.5l-5.2-9.2v9.2h-3.3v-14.3h3.5L461.4,380.9z"/>
                    <path d="M472.7,371.6c4.8,0,7.5,3.5,7.5,7.2s-2.7,7.2-7.5,7.2h-5.3v-14.3H472.7z M470.8,374.4v8.6h1.8c2.7,0,4.2-2.1,4.2-4.3s-1.6-4.3-4.2-4.3H470.8z"/>
                    <path className="sim-theme" fill={theme.accent} d="M230.6,69.7c-2.9,0-5.3,2.4-5.3,5.3c0,2.9,2.4,5.3,5.3,5.3c2.9,0,5.3-2.4,5.3-5.3C235.9,72.1,233.5,69.7,230.6,69.7"/>
                    <path className="sim-theme" fill={theme.accent} d="M269.9,50.2L269.9,50.2l-39.5,0v0c-14.1,0.1-24.6,10.7-24.6,24.8c0,13.9,10.4,24.4,24.3,24.7v0h39.6c14.2,0,24.8-10.6,24.8-24.7C294.5,61,284,50.3,269.9,50.2 M269.7,89.2L269.7,89.2l-39.3,0c-7.7-0.1-14-6.4-14-14.2c0-7.8,6.4-14.2,14.2-14.2h39.1c7.8,0,14.2,6.4,14.2,14.2C283.9,82.9,277.5,89.2,269.7,89.2"/>
                    <path className="sim-theme" fill={theme.accent} d="M269.7,80.3c2.9,0,5.3-2.4,5.3-5.3c0-2.9-2.4-5.3-5.3-5.3c-2.9,0-5.3,2.4-5.3,5.3C264.4,77.9,266.8,80.3,269.7,80.3"/>
                    <path className="sim-button-outer" d="M474.3,232.6h-56.2c-0.5,0-1-0.4-1-1v-56.2c0-0.5,0.4-1,1-1h56.2c0.5,0,1,0.4,1,1v56.2C475.3,232.2,474.8,232.6,474.3,232.6"
                        fill={theme.buttonOuter}
                        onMouseDown={ev => this.setState({ buttonBPressed: true }) }
                        onMouseUp={ev => this.setState({ buttonBPressed: false }) }
                        />
                    <path className="sim-button" fill={this.state.buttonBPressed ? theme.buttonDown : theme.buttonUp} d="M461.9,203.5c0,8.7-7,15.7-15.7,15.7c-8.7,0-15.7-7-15.7-15.7c0-8.7,7-15.7,15.7-15.7C454.9,187.8,461.9,194.9,461.9,203.5"/>
                    <path className="sim-button-outer" d="M82.1,232.6H25.9c-0.5,0-1-0.4-1-1v-56.2c0-0.5,0.4-1,1-1h56.2c0.5,0,1,0.4,1,1v56.2C83,232.2,82.6,232.6,82.1,232.6"
                        fill={theme.buttonOuter}
                        onMouseDown={ev => this.setState({ buttonAPressed: true }) }
                        onMouseUp={ev => this.setState({ buttonAPressed: false }) }
                        />
                    <path className="sim-button" fill={this.state.buttonAPressed ? theme.buttonDown : theme.buttonUp} d="M69.7,203.5c0,8.7-7,15.7-15.7,15.7s-15.7-7-15.7-15.7c0-8.7,7-15.7,15.7-15.7S69.7,194.9,69.7,203.5"/>
                    <path className="sim-display" fill={theme.display} d="M333.8,310.3H165.9c-8.3,0-15-6.7-15-15V127.5c0-8.3,6.7-15,15-15h167.8c8.3,0,15,6.7,15,15v167.8C348.8,303.6,342.1,310.3,333.8,310.3z"/>
                    {leds}
                </g>
            </svg>
            <div>
                <button className="mini compact ui button"
                    onMouseDown={ev => this.setState({ buttonAPressed: true, buttonBPressed: true, buttonABPressed: true }) }
                    onMouseUp={ev => this.setState({ buttonAPressed: false, buttonBPressed: false, buttonABPressed: false }) }>
                    <i className="circle icon"></i>A+B
                </button>            
                <button className="mini compact ui button">SHAKE</button>
                <button className="mini compact ui button">LOGO UP</button>
                <button className="mini compact ui button">LOGO DOWN</button>
                <button className="mini compact ui button">SCREEN UP</button>
                <button className="mini compact ui button">SCREEN DOWN</button>            
            </div>
            </div>
        )
    }
}