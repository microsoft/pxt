import * as React from "react";
import * as ReactDOM from "react-dom";
import * as workspace from "./workspace";
import * as data from "./data";
import * as pkg from "./package";
import * as core from "./core";
import * as sui from "./sui";

import Cloud = ks.Cloud;
import Util = ks.Util;
var lf = Util.lf

interface IBrowserProps { }
interface IBrowserState {
    searchFor?: string;
}

export class ScriptCard extends data.Component<{ data: Cloud.JsonScript }, {}> {
    
}

export class CardBrowser extends data.Component<IBrowserProps, IBrowserState> {
    prevData: Cloud.JsonScript[] = [];

    renderCore() {
        let res = this.state.searchFor ?
            this.getData("cloud:scripts?q=" + encodeURIComponent(this.state.searchFor)) : null
        if (res)
            this.prevData = res.items
        let data = this.prevData
        let upd = (v: any) => {
            this.setState({ searchFor: (v.target as any).value })
        };
        return (
            <div className="ui content form">
                <div className="ui fluid icon input">
                    <input type="text" placeholder="Search..." onChange={upd} />
                    <i className="search icon"/>
                </div>
            </div>
        );
    }
}
