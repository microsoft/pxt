/// <reference path="../../built/pxtlib.d.ts" />

import * as React from "react";
import * as sui from "./sui";
import { fireClickOnEnter } from "./util";
import { classList } from "../../react-common/components/util";

type GroupedError = {
    error: ErrorDisplayInfo,
    count: number,
    index: number
};

export type StackFrameDisplayInfo = {
    message: string,
    onClick?: () => void,
}

export type ErrorDisplayInfo = {
    message: string,
    stackFrames?: StackFrameDisplayInfo[],
    onClick?: () => void
};

export interface ErrorListProps {
    onSizeChange?: (state: pxt.editor.ErrorListState) => void;
    errors: ErrorDisplayInfo[];
    startDebugger?: () => void;
}
export interface ErrorListState {
    isCollapsed: boolean,
}

export class ErrorList extends React.Component<ErrorListProps, ErrorListState> {

    constructor(props: ErrorListProps) {
        super(props);

        this.state = {
            isCollapsed: true
        }

        this.onCollapseClick = this.onCollapseClick.bind(this);
    }

    componentDidUpdate(prevProps: Readonly<ErrorListProps>, prevState: Readonly<ErrorListState>, snapshot?: any): void {
        // Auto-expand if there are new errors
        if (this.props.errors.length > 0 && this.state.isCollapsed) {
            let shouldExpand = this.props.errors.length > prevProps.errors.length;

            if (!shouldExpand) {
                // Compare errors to see if there are new ones
                shouldExpand = this.props.errors.some(e => !prevProps.errors.some(prev => getErrorKey(e) === getErrorKey(prev)));
            }

            if (shouldExpand) {
                this.setState({ isCollapsed: false }, this.onDisplayStateChange);
            }
        }
    }

    render() {
        const { startDebugger, errors } = this.props;
        const { isCollapsed } = this.state;
        const errorsAvailable = !!errors?.length;

        const groupedErrors = groupErrors(errors);
        const errorListContent = !isCollapsed ? groupedErrors.map((e, i) => <ErrorListItem errorGroup={e} index={i} key={`errorlist_error_${i}`}/> ) : undefined;
        const errorCount = errors.length;
        const canDebug = startDebugger && !!errors.find(a => a.stackFrames?.length);

        return (
            <div className={classList("errorList", isCollapsed ? "errorListSummary" : undefined)} hidden={!errorsAvailable}>
                <div className="errorListHeader" role="button" aria-label={lf("{0} error list", isCollapsed ? lf("Expand") : lf("Collapse"))} onClick={this.onCollapseClick} onKeyDown={fireClickOnEnter} tabIndex={0}>
                    <h4>{lf("Problems")}</h4>
                    <div className="ui red circular label countBubble">{errorCount}</div>
                    <div className="toggleButton"><sui.Icon icon={`chevron ${isCollapsed ? 'up' : 'down'}`} /></div>
                </div>
                {!isCollapsed && <div className="errorListInner">
                    {canDebug && <div className="debuggerSuggestion" role="button" onClick={this.props.startDebugger} onKeyDown={fireClickOnEnter} tabIndex={0}>
                        {lf("Debug this project")}
                        <sui.Icon className="debug-icon" icon="icon bug" />
                    </div>}

                    <div className="ui selection list">
                        {errorListContent}
                    </div>
                </div>}
            </div>
        )
    }

    onDisplayStateChange() {
        const { errors } = this.props;
        const { isCollapsed } = this.state;
        // notify parent on possible size change so siblings (monaco)
        // can resize if needed

        const noValueToDisplay = !(errors?.length);

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
        if (this.state.isCollapsed) {
            pxt.tickEvent('errorlist.expand', null, { interactiveConsent: true })
        } else {
            pxt.tickEvent('errorlist.collapse', null, { interactiveConsent: true })
        }

        this.setState({
            isCollapsed: !this.state.isCollapsed
        }, this.onDisplayStateChange);
    }
}

interface ErrorListItemProps {
    index: number;
    errorGroup: GroupedError;
    className?: string;
}

interface ErrorListItemState {
}

class ErrorListItem extends React.Component<ErrorListItemProps, ErrorListItemState> {
    constructor(props: ErrorListItemProps) {
        super(props);
    }

    render() {
        const { className, errorGroup } = this.props
        const error = errorGroup.error;

        const message = error.message;

        return error.stackFrames ? (
            <div className={className}>
                <div className="exceptionMessage"
                    onClick={error.onClick}
                    onKeyDown={error.onClick ? fireClickOnEnter : undefined}
                    aria-label={error.message}
                    tabIndex={0}
                    role={error.onClick ? "button" : undefined}>
                    {error.message}
                </div>
                <div className="ui selection list">
                    {(error.stackFrames).map((childErr, index) => {
                        const errGrp = {error: childErr, count: 1, index: 0};
                        return <ErrorListItem key={index} index={index} errorGroup={errGrp} className="stackframe"/>
                    })}
                </div>
            </div>
        ) : (
            <div className={classList("item", className)} role="button"
                onClick={error.onClick}
                onKeyDown={fireClickOnEnter}
                aria-label={lf("Go to {0}: {1}", error.stackFrames ? '' : 'error', message)}
                tabIndex={0}>
                {message} {(errorGroup.count <= 1) ? null : <div className="ui gray circular label countBubble">{errorGroup.count}</div>}
            </div>
        );
    }
}

function groupErrors(errors: ErrorDisplayInfo[]): GroupedError[] {
    const grouped = new Map<string, GroupedError>();
    let index = 0;
    for (const error of errors) {
        const key = getErrorKey(error);
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

function getErrorKey(error: ErrorDisplayInfo): string {
    return error.message + (error.stackFrames ? error.stackFrames.map(f => f.message).join('') : '');
}