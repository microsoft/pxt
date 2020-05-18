/// <reference path="../../built/pxtlib.d.ts" />

import * as React from "react";
import * as sui from "./sui";

export interface ErrorListProps {
    onSizeChange: () => void,
    listenToErrorChanges: (key: string, onErrorChanges: (errors: pxtc.KsDiagnostic[]) => void) => void,
    goToError: (error: pxtc.KsDiagnostic) => void
}
export interface ErrorListState {
    isCollapsed: boolean
    errors: pxtc.KsDiagnostic[],
    activeKey: string
}

export class ErrorList extends React.Component<ErrorListProps, ErrorListState> {

    constructor(props: ErrorListProps) {
        super(props);

        this.state = {
            isCollapsed: true,
            errors: [],
            activeKey: null
        }

        this.onCollapseClick = this.onCollapseClick.bind(this)
        this.onErrorsChanged = this.onErrorsChanged.bind(this)
        this.onErrorMessageClick = this.onErrorMessageClick.bind(this)
        this.toggleActive = this.toggleActive.bind(this)

        props.listenToErrorChanges("errorList", this.onErrorsChanged);
    }

    render() {
        const {isCollapsed, errors, activeKey} = this.state;
        const errorsAvailable = !!errors?.length;
        const collapseTooltip = lf("Collapse Error List");
        function errorKey(error: pxtc.KsDiagnostic): string {
            // React likes have a "key" for each element so that it can smartly only
            // re-render what changes. Think of it like a hashcode/
            return `${error.messageText}-${error.fileName}-${error.line}-${error.column}`
        }

        const createOnErrorMessageClick = (e: pxtc.KsDiagnostic, key: string, index: number) => () =>
            this.onErrorMessageClick(e, key, index)

        let errorListContent;
        if (!isCollapsed) {
            errorListContent = (
                <div className="errorListContent ui selection list">
                    {(errors).map((e, index) =>
                    <div className="errorListItemContainer" key={errorKey(e)} role="button" onClick={createOnErrorMessageClick(e, errorKey(e), index)}>
                        <ErrorListItem error={e} active={activeKey === errorKey(e)}/>
                    </div>)
                    }
                </div>
            )
        }

        return (
            <div className={`errorList ${isCollapsed ? 'errorListSummary' : ''}`} hidden={!errorsAvailable}>
                <div className="errorListHeader" role="button" onClick={this.onCollapseClick}>
                    <h4>{lf("Problems")}</h4>
                    <div className="ui red circular label countBubble">{errors.length}</div>
                    <div className="toggleButton"><sui.Icon icon={`chevron ${isCollapsed ? 'up' : 'down'}`} onClick={this.onCollapseClick} /></div>
                </div>
                {!isCollapsed && <div className="errorListInner">{errorListContent}</div>}
            </div>
        )
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

    onErrorMessageClick(e: pxtc.KsDiagnostic, key: string, index: number) {
        pxt.tickEvent('errorlist.goto', {errorIndex: index}, { interactiveConsent: true });
        this.toggleActive(key)
        this.props.goToError(e)
    }

    onErrorsChanged(errors: pxtc.KsDiagnostic[]) {
        this.setState({
            errors,
            isCollapsed: errors?.length == 0 || this.state.isCollapsed
        })
    }

    toggleActive(key: string) {
        this.setState({activeKey: key})
    }
}

interface ErrorListItemProps {
    error: pxtc.KsDiagnostic,
    active: boolean
}

class ErrorListItem extends React.Component<ErrorListItemProps> {
    constructor(props: any) {
        super(props)
    }

    render() {
        const {error, active} = this.props
        return (
            <div className={`item ${active ? 'selected' : ''}`}>
            {lf("Line {0}: {1}", (error.endLine) ? error.endLine + 1 : error.line + 1, error.messageText)}
            </div>
        )
    }
}