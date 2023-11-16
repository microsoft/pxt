/// <reference path="../../built/pxtlib.d.ts" />

import * as React from "react";
import * as sui from "./sui";
import { fireClickOnEnter } from "./util";

import * as pxtblockly from "../../newblocks";

type GroupedError = {
    error: pxtc.KsDiagnostic,
    count: number,
    index: number
};

export interface ErrorListProps {
    isInBlocksEditor: boolean;
    onSizeChange?: (state: pxt.editor.ErrorListState) => void;
    listenToErrorChanges?: (key: string, onErrorChanges: (errors: pxtc.KsDiagnostic[]) => void) => void;
    listenToBlockErrorChanges?: (key: string, onErrorChanges: (errors: pxtblockly.BlockDiagnostic[]) => void) => void;
    listenToExceptionChanges?: (handlerKey: string, handler: (exception: pxsim.DebuggerBreakpointMessage, locations: pxtc.LocationInfo[]) => void) => void,
    goToError?: (errorLocation: pxtc.LocationInfo) => void;
    startDebugger?: () => void;
}
export interface ErrorListState {
    isCollapsed: boolean,
    errors?: pxtc.KsDiagnostic[],
    exception?: pxsim.DebuggerBreakpointMessage,
    callLocations?: pxtc.LocationInfo[],
    blockErrors?: pxtblockly.BlockDiagnostic[]
}

export class ErrorList extends React.Component<ErrorListProps, ErrorListState> {

    constructor(props: ErrorListProps) {
        super(props);

        this.state = {
            isCollapsed: true,
            errors: [],
            exception: null,
            blockErrors: []
        }

        this.onCollapseClick = this.onCollapseClick.bind(this)
        this.onErrorsChanged = this.onErrorsChanged.bind(this)
        this.onBlockErrorsChanged = this.onBlockErrorsChanged.bind(this)
        this.onExceptionDetected = this.onExceptionDetected.bind(this)
        this.onErrorMessageClick = this.onErrorMessageClick.bind(this)
        this.onDisplayStateChange = this.onDisplayStateChange.bind(this)
        this.getCompilerErrors = this.getCompilerErrors.bind(this)
        this.generateStackTraces = this.generateStackTraces.bind(this)
        this.listBlockErrors = this.listBlockErrors.bind(this)

        if (props.isInBlocksEditor) {
            props.listenToBlockErrorChanges("errorList", this.onBlockErrorsChanged)
        } else {
            props.listenToErrorChanges("errorList", this.onErrorsChanged);
            props.listenToExceptionChanges("errorList", this.onExceptionDetected);
        }
    }

    render() {
        const { isCollapsed, errors, exception, blockErrors } = this.state;
        const errorsAvailable = !!errors?.length || !!exception || !!blockErrors?.length;
        const collapseTooltip = lf("Collapse Error List");

        const errorListContent = !isCollapsed ? (this.props.isInBlocksEditor ? this.listBlockErrors(blockErrors)
            : (exception ? this.generateStackTraces(exception) : this.getCompilerErrors(errors))) : undefined;

        const errorCount = this.props.isInBlocksEditor ? blockErrors.length : exception ? 1 : errors.length;

        return (
            <div className={`errorList ${isCollapsed ? 'errorListSummary' : ''} ${this.props.isInBlocksEditor ? 'errorListBlocks' : ''}`} hidden={!errorsAvailable}>
                <div className="errorListHeader" role="button" aria-label={lf("{0} error list", isCollapsed ? lf("Expand") : lf("Collapse"))} onClick={this.onCollapseClick} onKeyDown={fireClickOnEnter} tabIndex={0}>
                    <h4>{lf("Problems")}</h4>
                    <div className="ui red circular label countBubble">{errorCount}</div>
                    <div className="toggleButton"><sui.Icon icon={`chevron ${isCollapsed ? 'up' : 'down'}`} /></div>
                </div>
                {!isCollapsed && <div className="errorListInner">
                    {exception && <div className="debuggerSuggestion" role="button" onClick={this.props.startDebugger} onKeyDown={fireClickOnEnter} tabIndex={0}>
                        {lf("Debug this project")}
                        <sui.Icon className="debug-icon" icon="icon bug" />
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

        if (this.props.onSizeChange) {
            this.props.onSizeChange(
                noValueToDisplay ?
                    undefined
                    : isCollapsed ?
                        pxt.editor.ErrorListState.HeaderOnly
                        : pxt.editor.ErrorListState.Expanded
            );
        }
    }

    onCollapseClick() {
        pxt.tickEvent('errorlist.collapse', null, { interactiveConsent: true })
        this.setState({
            isCollapsed: !this.state.isCollapsed
        }, this.onDisplayStateChange);
    }

    onErrorMessageClick(e: pxtc.LocationInfo, index: number) {
        pxt.tickEvent('errorlist.goto', { errorIndex: index }, { interactiveConsent: true });
        this.props.goToError(e)
    }

    onErrorsChanged(errors: pxtc.KsDiagnostic[]) {
        this.setState({
            errors,
            isCollapsed: errors?.length == 0 || this.state.isCollapsed,
            exception: null
        }, this.onDisplayStateChange);
    }

    onBlockErrorsChanged(blockErrors: pxtblockly.BlockDiagnostic[]) {
        this.setState({
            blockErrors,
            isCollapsed: blockErrors?.length == 0 || this.state.isCollapsed,
            exception: null
        }, this.onDisplayStateChange);
    }

    onExceptionDetected(exception: pxsim.DebuggerBreakpointMessage, callLocations: pxtc.LocationInfo[]) {
        this.setState({
            isCollapsed: false,
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

        const grouped = groupErrors(errors);
        return <div className="ui selection list">
            {grouped.map((e, index) => <ErrorListItem key={errorKey(e.error)} index={index} error={e} revealError={this.onErrorMessageClick} />)}
        </div>
    }

    generateStackTraces(exception: pxsim.DebuggerBreakpointMessage) {
        return <div>
            <div className="exceptionMessage">{pxt.Util.rlf(exception.exceptionMessage)}</div>
            <div className="ui selection list">
                {(exception.stackframes || []).map((sf, index) => {
                    const location = this.state.callLocations[sf.callLocationId];

                    if (!location) return null;

                    return <ErrorListItem key={index} index={index} stackframe={sf} location={location} revealError={this.onErrorMessageClick} />
                })}
            </div>
        </div>;
    }

    listBlockErrors(blockErrors: pxtblockly.BlockDiagnostic[]) {
        return <div className="ui selection list">
            {(blockErrors || []).map((e, i) => <ErrorListItem index={i} key={`${i}-${e}`} blockError={e} />)}
        </div>
    }
}

interface ErrorListItemProps {
    index: number;
    revealError?: (location: pxtc.LocationInfo, index: number) => void;
    error?: GroupedError;
    stackframe?: pxsim.StackFrameInfo;
    location?: pxtc.LocationInfo;
    blockError?: pxtblockly.BlockDiagnostic;
}

interface ErrorListItemState {
}


class ErrorListItem extends React.Component<ErrorListItemProps, ErrorListItemState> {
    constructor(props: ErrorListItemProps) {
        super(props)

        this.onErrorListItemClick = this.onErrorListItemClick.bind(this)
    }

    render() {
        const { error, stackframe, location, blockError } = this.props

        const message = blockError ? lf("{0}", blockError.message)
            : stackframe ? stackFrameMessageStringWithLineNumber(stackframe, location) :
                errorMessageStringWithLineNumber(error.error);
        const errorCount = (stackframe || blockError) ? 1 : error.count;

        return <div className={`item ${stackframe ? 'stackframe' : ''}`} role="button"
            onClick={!blockError ? this.onErrorListItemClick : undefined}
            onKeyDown={fireClickOnEnter}
            aria-label={lf("Go to {0}: {1}", stackframe ? '' : 'error', message)}
            tabIndex={0}>
            {message} {(errorCount <= 1) ? null : <div className="ui gray circular label countBubble">{errorCount}</div>}
        </div>
    }

    onErrorListItemClick() {
        const location = this.props.stackframe ? this.props.location : this.props.error.error
        this.props.revealError(location, this.props.index)
    }
}

function errorMessageStringWithLineNumber(error: pxtc.KsDiagnostic) {
    return lf("Line {0}: {1}", error.endLine ? error.endLine + 1 : error.line + 1, error.messageText);
}

function stackFrameMessageStringWithLineNumber(stackframe: pxsim.StackFrameInfo, location: pxtc.LocationInfo) {
    return lf("at {0} (line {1})", stackframe.funcInfo.functionName, location.line + 1);
}

function groupErrors(errors: pxtc.KsDiagnostic[]) {
    const grouped = new Map<string, GroupedError>();
    let index = 0;
    for (const error of errors) {
        const key = errorMessageStringWithLineNumber(error);
        if (!grouped.has(key)) {
            grouped.set(key, {
                index: index++,
                count: 1,
                error
            });
        }
        else {
            grouped.get(key).count++;
        }
    }
    const sorted: GroupedError[] = [];
    grouped.forEach(value => sorted.push(value));
    return sorted.sort((a, b) => a.index - b.index);
}
