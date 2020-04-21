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
        const showAvailableErrors = this.state.errors.length != 0;
        const showCollapseButton = true;
        const collapseTooltip = lf("Collapse Error List");
        function errorKey(error: pxtc.KsDiagnostic): string {
            // React likes have a "key" for each element so that it can smartly only
            // re-render what changes. Think of it like a hashcode/
            return `${error.messageText}-${error.fileName}-${error.line}-${error.column}`
        }
            
        return <div className="errorList" > 
            {showCollapseButton && showAvailableErrors &&
                <sui.Button id='toggleErrorList' className={`toggleErrorList collapse-button large`}
                icon={`inverted chevron ${this.state.isCollapsed ? 'up' : 'down'}`}
                title={collapseTooltip} onClick={this.onCollapseClick} />}
            {showAvailableErrors
                ? <div className="errorListInner" hidden={this.state.isCollapsed}>
                    {
                    (this.state.errors || []).map(e =>
                        <div key={errorKey(e)}>{`${e.messageText} - [line ${e.line + 1}: col ${e.column}]`}</div>)
                    }
                  </div>
                : <div className="errorListInner" id="noErrorsMessage">{lf("No Errors")}</div>
            }
        </div>
    }

    componentDidUpdate() {
        this.props.onSizeChange()
    }

    onCollapseClick() {
        this.setState({
            isCollapsed: !this.state.isCollapsed
        }, () => {
            this.props.onSizeChange()
        })
    }

    onErrorsChanged(errors: pxtc.KsDiagnostic[]) {
        this.setState({
            errors
        })
    }
}