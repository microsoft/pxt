import * as React from "react";
import * as ReactDOM from "react-dom";
import * as simsvg from "./simsvg";
import * as sui from "./sui"

import rt = yelm.rt;
import U = yelm.U;

export class MbitRuntime extends rt.Runtime {
    constructor(code: string, private view:simsvg.MbitBoardSvg) {
        super(code)
        U.assert(!!view)
        this.state = view.state;
    }

    updateDisplay() {
        this.view.updateState()
    }
}

export class MbitBoardView extends React.Component<simsvg.IBoardProps, rt.state.IBoard> {
    view: simsvg.MbitBoardSvg;

    constructor(props: simsvg.IBoardProps) {
        super(props);

        this.state = rt.state.createBoard();
        this.view = new simsvg.MbitBoardSvg(props, this.state);
    }

    componentDidMount() {
        var el: any = this.refs["simsvg"];
        el.appendChild(this.view.element);

        this.forceUpdate();
    }

    render() {
        var events = ["shake", "logo up", "logo down", "screen up", "screendown"];
        var eid = events[0];
        /*
        <div>                
            <sui.Dropdown class='selection search' value={eid}>
                {events.map(h => <sui.Item key={h} value={h} text={h} />) }
            </sui.Dropdown>
            <sui.Button class="secondary" icon="lab" popup="Simulate event."/>
        </div>
        */

        return (
            <div>
                <div ref="simsvg"></div>
            </div>
        )
    }
}