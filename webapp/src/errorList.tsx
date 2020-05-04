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
            isCollapsed: true,
            errors: []
        }

        this.onCollapseClick = this.onCollapseClick.bind(this)
        this.onErrorsChanged = this.onErrorsChanged.bind(this)

        props.listenToErrorChanges("errorList", this.onErrorsChanged);
    }

    render() {
        const {isCollapsed, errors} = this.state;
        const errorsAvailable = !!errors?.length;
        const collapseTooltip = lf("Collapse Error List");
        function errorKey(error: pxtc.KsDiagnostic): string {
            // React likes have a "key" for each element so that it can smartly only
            // re-render what changes. Think of it like a hashcode/
            return `${error.messageText}-${error.fileName}-${error.line}-${error.column}`
        }

        // Header
        const collapseButton = <div className="collapseButton"><sui.Icon icon={`chevron down`} onClick={this.onCollapseClick} /></div>
        const errorListHeader = <div className="errorListHeader">
            <h4>Problems</h4>
            {<div className="ui grey circular label countBubble">{errors?.length}</div>}
            {!isCollapsed && collapseButton}
        </div>

        const errorListContent = (errors).map(e =>
            <div key={errorKey(e)} className="errorMessage">{`${e.messageText} ${lf("at line {0}", e.line + 1)}`}</div>)

        return <div className={`errorList ${isCollapsed ? 'errorListSummary' : ''}`}
                    onClick={isCollapsed ? this.onCollapseClick : null}
                    role={isCollapsed ? "button" : null}
                    hidden={!errorsAvailable}>
            {errorListHeader}
            {!isCollapsed &&
                <div className="errorListInner">
                    {errorListContent}
                </div>
            }
        </div>
    }

    componentDidUpdate() {
        // notify parent on possible size change so siblings (monaco)
        // can resize if needed
        this.props.onSizeChange()
    }

    onCollapseClick() {
        this.setState({
            isCollapsed: !this.state.isCollapsed
        })
    }

    onErrorsChanged(errors: pxtc.KsDiagnostic[]) {
        this.setState({
            errors,
            isCollapsed: errors?.length == 0 || this.state.isCollapsed
        })
    }
}