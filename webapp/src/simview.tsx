import * as React from "react";
import * as ReactDOM from "react-dom";
import * as simsvg from "./simsvg"

export class MbitRuntime extends rt.Runtime {
    constructor(code:string) {
        super(code)
    }
}

export class MbitBoardView extends React.Component<simsvg.IMbitBoardProps, simsvg.IMbitBoard> {
    view : simsvg.MbitBoardSvg;

    constructor(props: simsvg.IMbitBoardProps) {
        super(props);

        this.view = new simsvg.MbitBoardSvg(props);
        this.state = this.view.state;
    }

    componentDidMount() {
        var el : any = this.refs["simsvg"];
        el.appendChild(this.view.element);
        
        this.forceUpdate();
    }

    render() {
        return (
            <div>
                <div ref="simsvg"></div>            
                <div>
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