import * as React from "react";
import * as ReactDOM from "react-dom";
import * as simsvg from "./simsvg"

export class MbitRuntime extends rt.Runtime {
    constructor(code:string) {
        super(code)
    }
}

export class MbitBoardView extends React.Component<simsvg.IBoardProps, rt.state.IBoard> {
    view : simsvg.MbitBoardSvg;

    constructor(props: simsvg.IBoardProps) {
        super(props);

        this.state =rt.state.createBoard();
        this.view = new simsvg.MbitBoardSvg(props, this.state);
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