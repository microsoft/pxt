/// <reference path="../../built/pxtlib.d.ts" />

import * as React from "react";
import * as sui from "./sui";

export interface ErrorListProps {
    onSizeChange: () => void,
    listenToErrorChanges: (key: string, onErrorChanges: (errors: pxtc.KsDiagnostic[]) => void) => void,
    goToError: (line: number, column: number) => void
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
        this.onErrorMessageClick = this.onErrorMessageClick.bind(this)

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

        const createOnErrorMessageClick = (e: pxtc.KsDiagnostic, index: number) => () => this.onErrorMessageClick(index, e.line + 1, e.column + 1)

        const errorListContent = (errors).map((e, index) =>
            <div key={errorKey(e)} className="errorMessage" role="button" onClick={createOnErrorMessageClick(e, index)}>
                {`${e.messageText} ${lf("at line {0}", e.line + 1)}`}
            </div>)

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
        pxt.tickEvent('errorlist.collapse', null, { interactiveConsent: true })
        this.setState({
            isCollapsed: !this.state.isCollapsed
        })
    }

    onErrorMessageClick(index: number, line: number, column: number) {
        pxt.tickEvent('errorlist.goto', {errorIndex: index}, { interactiveConsent: true });
        this.props.goToError(line, column)
    }

    onErrorsChanged(errors: pxtc.KsDiagnostic[]) {
        this.setState({
            errors,
            isCollapsed: errors?.length == 0 || this.state.isCollapsed
        })
    }
}