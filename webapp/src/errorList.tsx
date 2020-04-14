/// <reference path="../../built/pxtlib.d.ts" />

// TODO(dz): trim unused
import * as React from "react";
import * as data from "./data";
import * as sui from "./sui";
import * as md from "./marked";
import * as compiler from './compiler';
import * as ReactDOM from 'react-dom';
import * as pkg from './package';
import * as toolbox from "./toolbox";
import * as core from "./core";


export interface ErrorListProps {
    onSizeChange: () => void,
    errors: pxtc.KsDiagnostic[],
}
export interface ErrorListState {
    isCollapsed: boolean
}

export class ErrorList extends React.Component<ErrorListProps, ErrorListState> {

    constructor(props: ErrorListProps) {
        super(props);

        this.state = {
            isCollapsed: false
        }

        this.onCollapseClick = this.onCollapseClick.bind(this)
    }

    render() {
        const showCollapseButton = true;
        const collapseTooltip = "Collapse error list"
        return <div className="errorList" >
            {showCollapseButton &&
                <sui.Button id='toggleErrorList' className={`toggleErrorList collapse-button large`}
                    icon={`inverted chevron ${this.state.isCollapsed ? 'up' : 'down'}`}
                    title={collapseTooltip} onClick={this.onCollapseClick} />}
            <div className="errorListInner" hidden={this.state.isCollapsed}>
                {
                    (this.props.errors || []).map(e => <div>{e.messageText}</div>)
                }
            </div>
        </div>
    }

    onCollapseClick() {
        this.setState({
            isCollapsed: !this.state.isCollapsed
        }, () => {
            this.props.onSizeChange()
        })
    }
}