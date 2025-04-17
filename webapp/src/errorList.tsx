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

export type ErrorDisplayInfo = {
    message: string,
    childItems?: ErrorDisplayInfo[],
    onClick?: () => void
};

export interface ErrorListProps {
    onSizeChange?: (state: pxt.editor.ErrorListState) => void;
    listenToErrors?: (key: string, onErrors: (errors: ErrorDisplayInfo[]) => void) => void;
    startDebugger?: () => void;
}
export interface ErrorListState {
    isCollapsed: boolean,
    errors?: ErrorDisplayInfo[],
}

export class ErrorList extends React.Component<ErrorListProps, ErrorListState> {

    constructor(props: ErrorListProps) {
        super(props);

        this.state = {
            isCollapsed: true,
            errors: []
        }

        this.onCollapseClick = this.onCollapseClick.bind(this);
        this.onErrorsChanged = this.onErrorsChanged.bind(this);

        props.listenToErrors("errorList", this.onErrorsChanged);
    }

    render() {
        const { startDebugger } = this.props;
        const { isCollapsed, errors } = this.state;
        const errorsAvailable = !!errors?.length;
        const collapseTooltip = lf("Collapse Error List");

        const groupedErrors = groupErrors(errors);
        const errorListContent = !isCollapsed ? groupedErrors.map((e, i) => <ErrorListItem errorGroup={e} index={i} key={`errorlist_error_${i}`}/> ) : undefined;
        const errorCount = errors.length;

        return (
            <div className={classList("errorList", isCollapsed ? "errorListSummary" : undefined)} hidden={!errorsAvailable}>
                <div className="errorListHeader" role="button" aria-label={lf("{0} error list", isCollapsed ? lf("Expand") : lf("Collapse"))} onClick={this.onCollapseClick} onKeyDown={fireClickOnEnter} tabIndex={0}>
                    <h4>{lf("Problems")}</h4>
                    <div className="ui red circular label countBubble">{errorCount}</div>
                    <div className="toggleButton"><sui.Icon icon={`chevron ${isCollapsed ? 'up' : 'down'}`} /></div>
                </div>
                {!isCollapsed && <div className="errorListInner">
                    {startDebugger && <div className="debuggerSuggestion" role="button" onClick={this.props.startDebugger} onKeyDown={fireClickOnEnter} tabIndex={0}>
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
        const { errors, isCollapsed } = this.state;
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
        pxt.tickEvent('errorlist.collapse', null, { interactiveConsent: true })
        this.setState({
            isCollapsed: !this.state.isCollapsed
        }, this.onDisplayStateChange);
    }

    onErrorsChanged(errors: ErrorDisplayInfo[]) {
        this.setState({
            errors,
            isCollapsed: errors?.length == 0 || this.state.isCollapsed,
        }, this.onDisplayStateChange);
    }
}

interface ErrorListItemProps {
    index: number;
    errorGroup: GroupedError;
}

interface ErrorListItemState {
}

class ErrorListItem extends React.Component<ErrorListItemProps, ErrorListItemState> {
    constructor(props: ErrorListItemProps) {
        super(props);
    }

    render() {
        const { errorGroup } = this.props
        const error = errorGroup.error;

        const message = error.message;

        return error.childItems ? (
            <div>
                <div className="exceptionMessage"
                    onClick={error.onClick}
                    onKeyDown={error.onClick ? fireClickOnEnter : undefined}
                    aria-label={error.message}
                    tabIndex={error.onClick ? 0 : -1}>
                    {error.message}
                </div>
                <div className="ui selection list">
                    {(error.childItems).map((childErr, index) => {
                        const errGrp = {error: childErr, count: 1, index: 0};
                        return <ErrorListItem key={index} index={index} errorGroup={errGrp} />
                    })}
                </div>
            </div>
        ) : (
            <div className={`item ${error.childItems ? 'stackframe' : ''}`} role="button"
                onClick={error.onClick}
                onKeyDown={fireClickOnEnter}
                aria-label={lf("Go to {0}: {1}", error.childItems ? '' : 'error', message)}
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
    let key = error.message;
    for (const child of error.childItems || []) {
        key += getErrorKey(child);
    }
    return key;
}