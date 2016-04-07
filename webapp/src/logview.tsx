/// <reference path="../../built/kindsim.d.ts" />

import * as React from "react";
import * as ReactDOM from "react-dom";
import * as sui from "./sui"
import * as core from "./core";


export class LogView extends React.Component<{}, {}> {
    private view : ks.rt.logs.LogViewElement;
    
    constructor(props: any) {
        super(props);
        this.view = new ks.rt.logs.LogViewElement()
    }
    
    componentDidMount() {
        let node = ReactDOM.findDOMNode(this);
        node.appendChild(this.view.element);
    }

    clear() {
        this.view.clear();
    }

    render() {
        return <div/>
    }
}