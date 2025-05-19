/// <reference path="../../built/pxtlib.d.ts" />

import * as React from "react";
import * as auth from "./auth";
import * as sui from "./sui";
import * as core from "./core";
import { fireClickOnEnter } from "./util";
import { classList } from "../../react-common/components/util";
import { Button } from "../../react-common/components/controls/Button";

type GroupedError = {
    error: ErrorDisplayInfo;
    count: number;
    index: number;
};

/**
 * A collection of optional metadata that can be attached to an error.
 */
export type ErrorMetadata = {
    blockId?: string;
};

export type StackFrameDisplayInfo = {
    message: string;
    metadata?: ErrorMetadata;
    onClick?: () => void;
};

export type ErrorDisplayInfo = {
    message: string;
    stackFrames?: StackFrameDisplayInfo[];
    metadata?: ErrorMetadata;
    onClick?: () => void;
};

export interface ErrorListProps {
    onSizeChange?: (state: pxt.editor.ErrorListState) => void;
    errors: ErrorDisplayInfo[];
    note?: string | JSX.Element;
    startDebugger?: () => void;
    getErrorHelp?: () => Promise<void>; // Should return a promise that resolves when the help is loaded
    showLoginDialog?: (
        continuationHash?: string,
        dialogMessages?: { signInMessage?: string; signUpMessage?: string }
    ) => void;
}

export interface ErrorListState {
    isCollapsed: boolean;
    isLoadingHelp?: boolean;
}

export class ErrorList extends auth.Component<ErrorListProps, ErrorListState> {
    constructor(props: ErrorListProps) {
        super(props);

        this.state = {
            isCollapsed: true,
            isLoadingHelp: false,
        };

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

    onHelpClick = async () => {
        // Sign-in required. Prompt the user, if they are logged out.
        if (!this.isLoggedIn()) {
            pxt.tickEvent("errorlist.showSignIn");
            this.props.showLoginDialog("editor", {
                signInMessage: lf("Sign-in is required to use this feature"),
                signUpMessage: lf("Sign-up is required to use this feature"),
            });
            return;
        }

        // We need to get permission to send the code & errors to AI.
        const permission = await core.confirmAsync({
            header: lf("Permission Required"),
            body: lf("We’ll send your code and the errors to an AI to help explain the issue. Do you want to continue?"),
            agreeLbl: lf("Yes"),
            disagreeLbl: lf("No"),
        });
        if (!permission) {
            pxt.tickEvent("errorlist.permissionDenied");
            return;
        }

        this.setState({ isLoadingHelp: true });
        await this.props.getErrorHelp();
        this.setState({ isLoadingHelp: false });
    };

    renderCore() {
        const { startDebugger, errors, getErrorHelp, showLoginDialog, note } = this.props;
        const { isCollapsed, isLoadingHelp } = this.state;
        const errorsAvailable = !!errors?.length;

        const groupedErrors = groupErrors(errors);
        const errorListContent = !isCollapsed ? groupedErrors.map((e, i) => <ErrorListItem errorGroup={e} index={i} key={`errorlist_error_${i}`}/> ) : undefined;
        const errorCount = errors.length;
        const canDebug = startDebugger && !!errors.find(a => a.stackFrames?.length);

        const showErrorHelp = !!getErrorHelp && !!showLoginDialog && pxt.appTarget.appTheme.aiErrorHelp;

        const helpLoader = (
            <div className="error-help-loader" onClick={(e) => e.stopPropagation()}>
                <div className="common-spinner" />
                <span className="analyzing-label">{lf("Analyzing...")}</span>
            </div>
        );

        const helpButton = (
            <Button
                id="error-help-button"
                onClick={this.onHelpClick}
                title={lf("Help me understand")}
                className="secondary error-help-button"
                label={lf("Help me understand")}
                leftIcon={"fas fa-question-circle"}
            />
        );

        return (
            <div className={classList("errorList", isCollapsed ? "errorListSummary" : undefined)} hidden={!errorsAvailable}>
                <div className="errorListHeader" role="button" aria-label={lf("{0} error list", isCollapsed ? lf("Expand") : lf("Collapse"))} onClick={this.onCollapseClick} onKeyDown={fireClickOnEnter} tabIndex={0}>
                    <h4>{lf("Problems")}</h4>
                    <div className="ui red circular label countBubble">{errorCount}</div>
                    {showErrorHelp && (
                        <div className={classList("error-help-container", isLoadingHelp ? "loading" : undefined)}>
                            {isLoadingHelp ? helpLoader : helpButton}
                        </div>
                    )}
                    <div className="filler" />
                    <div className="toggleButton">
                        <sui.Icon icon={`chevron ${isCollapsed ? "up" : "down"}`} />
                    </div>
                </div>
                {!isCollapsed && <div className="errorListInner">
                    {canDebug && <div className="debuggerSuggestion" role="button" onClick={this.props.startDebugger} onKeyDown={fireClickOnEnter} tabIndex={0}>
                        {lf("Debug this project")}
                        <sui.Icon className="debug-icon" icon="icon bug" />
                    </div>}

                    {note && <div className="note">{note}</div>}

                    <div className="ui selection list">
                        {errorListContent}
                    </div>
                </div>}
            </div>
        );
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

        const isInteractive = !!error.onClick;
        const hasStack = !!error.stackFrames && error.stackFrames.length > 0;
        const topRowClass = hasStack ? "exceptionMessage" : classList("item", className);
        const errorCounter = (errorGroup.count <= 1) ? null : <div className="ui gray circular label countBubble">{errorGroup.count}</div>;

        const itemHeaderRow = isInteractive ? (
            <Button className={topRowClass}
                onClick={error.onClick}
                title={lf("Go to error: {0}", error.message)}
                aria-label={lf("Go to error: {0}", error.message)}>
                <div>
                    <span>{error.message}</span>
                    {errorCounter}
                </div>
            </Button>
        ) : (
             <div className={topRowClass} aria-label={error.message} tabIndex={0}>
                <span>{error.message}</span>
                {errorCounter}
            </div>
        );

        return !hasStack ? itemHeaderRow : (
            <div className={className}>
                {itemHeaderRow}
                <div className="ui selection list">
                    {(error.stackFrames).map((childErr, index) => {
                        const errGrp = {error: childErr, count: 1, index: 0};
                        return <ErrorListItem key={index} index={index} errorGroup={errGrp} className="stackframe"/>
                    })}
                </div>
            </div>
        )
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
    return JSON.stringify({
        message: error.message,
        stackFrames: error.stackFrames
    });
}