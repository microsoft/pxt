/// <reference path="../../built/pxtlib.d.ts" />

import * as React from "react";
import * as sui from "./sui";

export interface ErrorListProps {
    onSizeChange: (state: pxt.editor.ErrorListState) => void;
    listenToErrorChanges: (key: string, onErrorChanges: (errors: pxtc.KsDiagnostic[]) => void) => void;
    listenToExceptionChanges: (handlerKey: string, handler: (exception: pxsim.DebuggerBreakpointMessage, locations: pxtc.LocationInfo[]) => void) => void,
    goToError: (error: pxtc.KsDiagnostic) => void;
    startDebugger: () => void;
}
export interface ErrorListState {
    isCollapsed: boolean,
    errors: pxtc.KsDiagnostic[],
    exception?: pxsim.DebuggerBreakpointMessage,
    callLocations?: pxtc.LocationInfo[]
}

export class ErrorList extends React.Component<ErrorListProps, ErrorListState> {

    constructor(props: ErrorListProps) {
        super(props);

        this.state = {
            isCollapsed: true,
            errors: [],
            exception: null
        }

        this.onCollapseClick = this.onCollapseClick.bind(this)
        this.onErrorsChanged = this.onErrorsChanged.bind(this)
        this.onExceptionDetected = this.onExceptionDetected.bind(this)
        this.onErrorMessageClick = this.onErrorMessageClick.bind(this)
        this.onDisplayStateChange = this.onDisplayStateChange.bind(this)

        props.listenToErrorChanges("errorList", this.onErrorsChanged);
        props.listenToExceptionChanges("errorList", this.onExceptionDetected)
    }

    render() {
        const {isCollapsed, errors, exception} = this.state;
        const errorsAvailable = !!errors?.length || !!exception;
        const collapseTooltip = lf("Collapse Error List");
        function errorKey(error: pxtc.KsDiagnostic): string {
            // React likes have a "key" for each element so that it can smartly only
            // re-render what changes. Think of it like a hashcode/
            return `${error.messageText}-${error.fileName}-${error.line}-${error.column}`
        }

        const createOnErrorMessageClick = (e: pxtc.KsDiagnostic, index: number) => () =>
            this.onErrorMessageClick(e, index)

        let errorListContent;
        if (!isCollapsed) {
            if (exception) {
                errorListContent = (
                    <div>
                        <div className="exceptionMessage">{pxt.Util.rlf(exception.exceptionMessage)}</div>
                        {this.generateStackTraces(exception)}
                    </div>
                )
            } else {
                errorListContent = (
                    <div className="ui selection list">
                        {(errors).map((e, index) =>
                        <div className="item" key={errorKey(e)} role="button" onClick={createOnErrorMessageClick(e, index)} onKeyDown={sui.fireClickOnEnter}>
                            {lf("Line {0}: {1}", (e.endLine) ? e.endLine + 1 : e.line + 1, e.messageText)}
                        </div>)
                        }
                    </div>
                )
            }
        }

        return (
            <div className={`errorList ${isCollapsed ? 'errorListSummary' : ''}`} hidden={!errorsAvailable}>
                <div className="errorListHeader" role="button" onClick={this.onCollapseClick} onKeyDown={sui.fireClickOnEnter} tabIndex={0}>
                    <h4>{lf("Problems")}</h4>
                    <div className="ui red circular label countBubble">{exception ? 1 : errors.length}</div>
                    <div className="toggleButton" onClick={this.onCollapseClick} onKeyDown={sui.fireClickOnEnter} tabIndex={0}><sui.Icon icon={`chevron ${isCollapsed ? 'up' : 'down'}`}/></div>
                </div>
                {!isCollapsed && <div className="errorListInner">
                    {exception && <div className="debuggerSuggestion" role="button" onClick={this.props.startDebugger} onKeyDown={sui.fireClickOnEnter}>
                        {lf("Debug this project")}
                        <sui.Icon className="debug-icon blue" icon="icon bug"/>
                    </div>}
                    {errorListContent}
                </div>}
            </div>
        )
    }

    onDisplayStateChange() {
        const { errors, exception, isCollapsed } = this.state;
        // notify parent on possible size change so siblings (monaco)
        // can resize if needed

        const noValueToDisplay = !(errors?.length || exception);
        this.props.onSizeChange(
            noValueToDisplay ?
                undefined
                : isCollapsed ?
                    pxt.editor.ErrorListState.HeaderOnly
                    : pxt.editor.ErrorListState.Expanded
        );
    }

    onCollapseClick() {
        pxt.tickEvent('errorlist.collapse', null, { interactiveConsent: true })
        this.setState({
            isCollapsed: !this.state.isCollapsed
        }, this.onDisplayStateChange);
    }

    onErrorMessageClick(e: pxtc.KsDiagnostic, index: number) {
        pxt.tickEvent('errorlist.goto', {errorIndex: index}, { interactiveConsent: true });
        this.props.goToError(e)
    }

    onErrorsChanged(errors: pxtc.KsDiagnostic[]) {
        this.setState({
            errors,
            isCollapsed: errors?.length == 0 || this.state.isCollapsed,
            exception: null
        }, this.onDisplayStateChange);
    }

    onExceptionDetected(exception: pxsim.DebuggerBreakpointMessage, callLocations: pxtc.LocationInfo[]) {
        this.setState({
            exception,
            callLocations
        })
    }

    private generateStackTraces(exception: pxsim.DebuggerBreakpointMessage) {
        return <div className="ui selection list">
            {(exception.stackframes || []).map((sf, index) => {
                const location = this.state.callLocations[sf.callLocationId];

                if (!location) return null;

                return <div className="item stackframe" key={index}>
                    {lf("at {0} ({1}:{2}:{3})", sf.funcInfo.functionName, sf.funcInfo.fileName, location.line + 1, location.column + 1)}
                </div>
            })}
        </div>;
    }
}