/// <reference path="../../built/pxtlib.d.ts" />

import * as React from "react";
import * as sui from "./sui";
import * as blocks from "./blocks";
import { fireClickOnEnter } from "./util";

import * as pxtblockly from "../../pxtblocks";

type GroupedError = {
    error: pxtc.KsDiagnostic,
    count: number,
    index: number
};

// TODO thsparks : Move into a different file?
export type BlockError = {
    blockId: string;
    message: string;
}

export interface ErrorListProps {
    parent: pxt.editor.IProjectView; // TODO thsparks : Do we need the full parent?
    isInBlocksEditor: boolean;
    onSizeChange?: (state: pxt.editor.ErrorListState) => void;
    listenToErrorChanges?: (key: string, onErrorChanges: (errors: pxtc.KsDiagnostic[]) => void) => void;
    listenToBlockErrorChanges?: (key: string, onErrorChanges: (errors: BlockError[]) => void) => void;
    listenToExceptionChanges?: (handlerKey: string, handler: (exception: pxsim.DebuggerBreakpointMessage, locations: pxtc.LocationInfo[]) => void) => void,
    goToError?: (errorLocation: pxtc.LocationInfo) => void;
    startDebugger?: () => void;
}
export interface ErrorListState {
    isCollapsed: boolean,
    errors?: pxtc.KsDiagnostic[],
    exception?: pxsim.DebuggerBreakpointMessage,
    callLocations?: pxtc.LocationInfo[],
    blockErrors?: BlockError[]
}

export class ErrorList2 extends React.Component<ErrorListProps, ErrorListState> {

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
        }

        if (props.listenToExceptionChanges) {
            props.listenToExceptionChanges("errorList", this.onExceptionDetected);
        }
    }

    render() {
        const { isCollapsed, errors, exception, blockErrors } = this.state;
        const errorsAvailable = !!errors?.length || !!exception || !!blockErrors?.length;
        const collapseTooltip = lf("Collapse Error List");

        const errorListContent = !isCollapsed ? (exception ? this.generateStackTraces(exception)
            : (this.props.isInBlocksEditor ? this.listBlockErrors(blockErrors) : this.getCompilerErrors(errors))) : undefined;

        const errorCount = exception ? 1 : this.props.isInBlocksEditor ? blockErrors.length : errors.length;

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
        if (this.props.goToError) {
            pxt.tickEvent('errorlist.goto', { errorIndex: index }, { interactiveConsent: true });
            this.props.goToError(e);
        }
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
            {grouped.map((e, index) => <ErrorListItem key={errorKey(e.error)} index={index} error={e} onClick={() => this.onErrorMessageClick(e.error, index)} />)}
        </div>
    }

    generateStackTraces(exception: pxsim.DebuggerBreakpointMessage) {
        return <div>
            <div className="exceptionMessage">{pxt.Util.rlf(exception.exceptionMessage)}</div>
            <div className="ui selection list">
                {(exception.stackframes || []).map((sf, index) => {
                    const location = this.state.callLocations?.[sf.callLocationId];

                    return <ErrorListItem key={index} index={index} stackframe={sf} location={location} onClick={() => this.onErrorMessageClick(location, index)} />
                })}
            </div>
        </div>;
    }

    listBlockErrors(blockErrors: BlockError[]) {
        return <div className="ui selection list">
            {(blockErrors || []).map((e, i) => <ErrorListItem index={i} key={`${i}-${e}`} blockError={e} onClick={(() => this.focusOnBlock(e.blockId))} />)}
        </div>
    }

    focusOnBlock(blockId: string) {
        if(!this.props.parent.isBlocksActive()) return;

        // TODO thsparks : This should probably be moved out into an editor function (maybe one each editor implements itself).
        const blocksEditor = this.props.parent.editor as blocks.Editor;
        blocksEditor?.editor?.centerOnBlock(blockId);
    }
}

interface ErrorListItemProps {
    index: number;
    onClick?: () => void;
    error?: GroupedError;
    stackframe?: pxsim.StackFrameInfo;
    location?: pxtc.LocationInfo;
    blockError?: BlockError;
}

interface ErrorListItemState {
}

class ErrorListItem extends React.Component<ErrorListItemProps, ErrorListItemState> {
    constructor(props: ErrorListItemProps) {
        super(props);
    }

    render() {
        const { error, stackframe, location, blockError } = this.props

        const message = blockError ? lf("{0}", blockError.message)
            : stackframe ? stackFrameMessageStringWithLineNumber(stackframe, location) :
                errorMessageStringWithLineNumber(error.error);
        const errorCount = (stackframe || blockError) ? 1 : error.count;

        return <div className={`item ${stackframe ? 'stackframe' : ''}`} role="button"
            onClick={this.props.onClick}
            onKeyDown={fireClickOnEnter}
            aria-label={lf("Go to {0}: {1}", stackframe ? '' : 'error', message)}
            tabIndex={0}>
            {message} {(errorCount <= 1) ? null : <div className="ui gray circular label countBubble">{errorCount}</div>}
        </div>
    }
}

function errorMessageStringWithLineNumber(error: pxtc.KsDiagnostic) {
    return lf("Line {0}: {1}", error.endLine ? error.endLine + 1 : error.line + 1, error.messageText);
}

function stackFrameMessageStringWithLineNumber(stackframe: pxsim.StackFrameInfo, location?: pxtc.LocationInfo) {
    if (!location) {
        return lf("at {0}", stackframe.funcInfo.functionName);
    } else {
        return lf("at {0} (line {1})", stackframe.funcInfo.functionName, location.line + 1);
    }
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
