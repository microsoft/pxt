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
        const {isCollapsed, errors} = this.state;
        const errorsAvailable = !!errors?.length;
        const collapseTooltip = lf("Collapse Error List");
        function errorKey(error: pxtc.KsDiagnostic): string {
            // React likes have a "key" for each element so that it can smartly only
            // re-render what changes. Think of it like a hashcode/
            return `${error.messageText}-${error.fileName}-${error.line}-${error.column}`
        }

        const xButton = <sui.CloseButton onClick={this.onCollapseClick} />

        let errorListContent;
        if (errorsAvailable) {
            if (isCollapsed) {
                errorListContent = <div className="summaryMessage" role="button" onClick={this.onCollapseClick}>
                    {lf("Error List: Uh oh! We found {0} error(s)", errors.length)}
                </div>
            } else {
                errorListContent = (errors).map(e =>
                    <div key={errorKey(e)}>{`${e.messageText} - (${e.line + 1}:${e.column + 1})`}</div>)
            }
        } else {
            errorListContent = <div>{lf("Error List: looking good!")}</div>
        }

        return <div className={`errorList ${isCollapsed ? 'errorListSummary' : ''}`}>
            <div className="errorListInner">
                <h4 hidden={isCollapsed}>Error List</h4>
                {!isCollapsed && xButton}
                {errorListContent}
            </div>
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