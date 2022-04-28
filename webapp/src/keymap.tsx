/// <reference path="../../built/pxtlib.d.ts" />

import * as React from "react";
import * as data from "./data";
import * as sui from "./sui";

type ISettingsProps = pxt.editor.ISettingsProps;

interface KeymapState {
    above?: boolean;
}

interface KeymapData {
    title: string;
    map: { [key: string]: string[] };
};

export class Keymap extends data.Component<ISettingsProps, KeymapState> {
    private static _data: { [key: string]: KeymapData[] };
    protected keymap: KeymapData[];
    constructor(props: ISettingsProps) {
        super(props);

        this.setData();
        const board = pxt.appTarget && pxt.appTarget.appTheme
            && pxt.appTarget.appTheme.boardName.toLowerCase();
        this.keymap = board && Keymap._data[board];
        this.state = { above: true };
    }

    hideKeymap = () => {
        this.props.parent.showKeymap(false);
    }

    renderCore() {
        return <div className={`keymap ${this.state.above ? 'above' : ''}`} ref="keymap">
            <i className="icon large close remove circle" role="presentation" onClick={this.hideKeymap}></i>
            {this.keymap && this.keymap.map((col, i) => {
                return <div key={i}>
                    <span className="keymap-title">{col.title}</span>
                    {
                        Object.keys(col.map).map( (el, j) => {
                            return <div key={j} className="keymap-row">
                                {col.map[el].map( (key, j) => {
                                    return <div className="keymap-key" key={j}>{key}</div>
                                })}
                                <span className="keymap-name">{el}</span>
                            </div>
                        })
                    }
                </div>
            })}
        </div>;
    }

    private setData() {
        if (!Keymap._data) {
            Keymap._data = {
                "arcade": [ {
                        title: lf("player 1"),
                        map: {
                            [lf("up")]: ["↑", "W"],
                            [lf("down")]: ["↓", "S"],
                            [lf("left")]: ["←", "A"],
                            [lf("right")]: ["→", "D"],
                            "a": ["Z", lf("{id:keyboard symbol}space")],
                            "b": ["X", lf("{id:keyboard symbol}enter")]
                        }
                    },
                    {
                        title: lf("player 2"),
                        map: {
                            [lf("up")]: ["I"],
                            [lf("down")]: ["K"],
                            [lf("left")]: ["J"],
                            [lf("right")]: ["L"],
                            [lf("a")]: ["U"],
                            [lf("b")]: ["O"]
                        }
                    } ]
                }
            }
    }
}