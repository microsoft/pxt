/// <reference path="../../built/pxtlib.d.ts" />

import * as React from "react";
import * as sui from "./sui";

export interface ErrorListProps {
    onSizeChange: (state: pxt.editor.ErrorListState) => void;
    listenToErrorChanges: (key: string, onErrorChanges: (errors: pxtc.KsDiagnostic[]) => void) => void;
    listenToExceptionChanges: (handlerKey: string, handler: (exception: pxsim.DebuggerBreakpointMessage, locations: pxtc.LocationInfo[]) => void) => void,
    goToError: (errorLocation: pxtc.LocationInfo) => void;
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
        this.getCompilerErrors = this.getCompilerErrors.bind(this)
        this.generateStackTraces = this.generateStackTraces.bind(this)

        props.listenToErrorChanges("errorList", this.onErrorsChanged);
        props.listenToExceptionChanges("errorList", this.onExceptionDetected)
    }

    render() {
        const {isCollapsed, errors, exception} = this.state;
        const errorsAvailable = !!errors?.length || !!exception;
        const collapseTooltip = lf("Collapse Error List");

        const errorListContent = !isCollapsed ? (exception ? this.generateStackTraces(exception) : this.getCompilerErrors(errors)) : undefined;

        return (
            <div className={`errorList ${isCollapsed ? 'errorListSummary' : ''}`} hidden={!errorsAvailable}>
                <div className="errorListHeader" role="button" aria-label={lf("{0} error list", isCollapsed ? lf("Expand") : lf("Collapse"))} onClick={this.onCollapseClick} onKeyDown={sui.fireClickOnEnter} tabIndex={0}>
                    <h4>{lf("Problems")}</h4>
                    <div className="ui red circular label countBubble">{exception ? 1 : errors.length}</div>
                    <div className="toggleButton"><sui.Icon icon={`chevron ${isCollapsed ? 'up' : 'down'}`}/></div>
                </div>
                {!isCollapsed && <div className="errorListInner">
                    {exception && <div className="debuggerSuggestion" role="button" onClick={this.props.startDebugger} onKeyDown={sui.fireClickOnEnter} tabIndex={0}>
                        {lf("Debug this project")}
                        <sui.Icon className="debug-icon" icon="icon bug"/>
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

    onErrorMessageClick(e: pxtc.LocationInfo, index: number) {
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

    getCompilerErrors(errors: pxtc.KsDiagnostic[]) {
        function errorKey(error: pxtc.KsDiagnostic): string {
            // React likes have a "key" for each element so that it can smartly only
            // re-render what changes. Think of it like a hashcode/
            return `${error.messageText}-${error.fileName}-${error.line}-${error.column}`
        }

        return <div className="ui selection list">
            {(errors).map((e, index) => <ErrorListItem key={errorKey(e)} index={index} error={e} revealError={this.onErrorMessageClick} />)}
        </div>
    }

    generateStackTraces(exception: pxsim.DebuggerBreakpointMessage) {
        return <div>
            <div className="exceptionMessage">{pxt.Util.rlf(exception.exceptionMessage)}</div>
            <div className="ui selection list">
                {(exception.stackframes || []).map((sf, index) => {
                    const location = this.state.callLocations[sf.callLocationId];

                    if (!location) return null;

                    return <ErrorListItem key={index} index={index} stackFrame={sf} location={location} revealError={this.onErrorMessageClick}/>
                })}
            </div>
        </div>;
    }
}

interface ErrorListItemProps {
    index: number;
    error?: pxtc.KsDiagnostic;
    stackFrame?: pxsim.StackFrameInfo;
    location?: pxtc.LocationInfo;
    revealError: (location: pxtc.LocationInfo, index: number) => void;
}

interface ErrorListItemState {
}


class ErrorListItem extends React.Component<ErrorListItemProps, ErrorListItemState> {
    constructor(props: ErrorListItemProps) {
        super(props)

        this.onErrorListItemClick = this.onErrorListItemClick.bind(this)
    }

    render() {
        const {error, stackFrame, location} = this.props

        const message = stackFrame ? lf("at {0} line {1}", stackFrame.funcInfo.functionName, location.line + 1)
            : lf("Line {0}: {1}", error.endLine ? error.endLine + 1 : error.line + 1, error.messageText)

        return <div className={`item ${stackFrame ? 'stackframe' : ''}`} role="button"
                    onClick={this.onErrorListItemClick}
                    onKeyDown={sui.fireClickOnEnter}
                    aria-label={lf("Go to {0}: {1}", stackFrame ? '' : 'error', message)}
                    tabIndex={0}>
            {message}
        </div>
    }

    onErrorListItemClick() {
        const location = this.props.stackFrame ? this.props.location : this.props.error
        this.props.revealError(location, this.props.index)
    }
}
