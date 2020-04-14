/// <reference path="../../built/pxtlib.d.ts" />

import * as React from "react";
import * as sui from "./sui";

export interface ErrorListProps {
    onSizeChange: () => void,
    listenToErrorChanges: (key: string, onErrorChanges: (errors: pxtc.KsDiagnostic[]) => void) => void,
}
export interface ErrorListState {
    isCollapsed: boolean
    errors: pxtc.KsDiagnostic[],
}

export class ErrorList extends React.Component<ErrorListProps, ErrorListState> {

    constructor(props: ErrorListProps) {
        super(props);

        this.state = {
            isCollapsed: false,
            errors: []
        }

        this.onCollapseClick = this.onCollapseClick.bind(this)
        this.onErrorsChanged = this.onErrorsChanged.bind(this)

        props.listenToErrorChanges("errorList", this.onErrorsChanged);
    }

    render() {
        const showCollapseButton = true;
        const collapseTooltip = "Collapse error list"
        function errorKey(error: pxtc.KsDiagnostic): string {
            // React likes have a "key" for each element so that it can smartly only
            // re-render what changes. Think of it like a hashcode/
            return `${error.messageText}-${error.fileName}-${error.line}-${error.column}`
        }
        return <div className="errorList" >
            {showCollapseButton &&
                <sui.Button id='toggleErrorList' className={`toggleErrorList collapse-button large`}
                    icon={`inverted chevron ${this.state.isCollapsed ? 'up' : 'down'}`}
                    title={collapseTooltip} onClick={this.onCollapseClick} />}
            <div className="errorListInner" hidden={this.state.isCollapsed}>
                {
                    (this.state.errors || []).map(e =>
                        <div key={errorKey(e)}>{e.messageText}</div>)
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

    onErrorsChanged(errors: pxtc.KsDiagnostic[]) {
        console.log("errorList - onErrorsChanged: " + errors.length)
        this.setState({
            errors
        })
    }
}