import * as React from "react";
import * as ReactDOM from "react-dom";
import * as sui from "../sui"

import rt = yelm.rt;
import U = yelm.U;

export class BoardView extends React.Component<{ runtime: rt.Runtime }, {}> {
    render() {
        let runtime = this.props.runtime

        if (!runtime) return null

        if (runtime.target.name != "minecraft") return null;
        
        return (
            <div>
                <div ref="minecraft"></div>
            </div>
        )
    }
}