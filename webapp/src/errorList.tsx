/// <reference path="../../built/pxtlib.d.ts" />

import * as React from "react";
import * as sui from "./sui";
import { REDO_IMAGE_EDIT } from "./components/ImageEditor/actions/types";

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

        // let errorListContent;
        // if (!isCollapsed) {
        //     errorListContent = (
        //         <div className="ui selection list">
        //             {(errors).map((e, index) =>
        //             <div className={`item ${activeKey === errorKey(e) ? 'active': ''}`} key={errorKey(e)} data-key={errorKey(e)} role="button" onClick={createOnErrorMessageClick(e, errorKey(e), index)}>
        //                 {lf("Line {0}: {1}", (e.endLine) ? e.endLine + 1 : e.line + 1, e.messageText)}
        //             </div>)
        //             }
        //         </div>
        //     )
        // }

        let errorListContent;
        if (!isCollapsed) {
            errorListContent = (
                <div className="errorListContent">
                    {(errors).map((e, index) =>
                    <div className="errorListItem" key={errorKey(e)} role="button" onClick={createOnErrorMessageClick(e, errorKey(e), index)}>
                        <ErrorListItem error={e} active={activeKey === errorKey(e)}/>
                    </div>)
                    }
                </div>
            )
        }

        // let errorListContent;
        // if (!isCollapsed) {
        //     errorListContent = (
        //         <div className="errorListContent">
        //             {(errors).map((e, index) =>
        //                 <ErrorListItem key={errorKey(e)} data-key={errorKey(e)} error={e} active={errorKey(e) === activeKey} onToggle={this.toggleActive}/>)
        //             }
        //         </div>
        //     )
        // }

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
            <div className={`messageText ${active ? 'active' : ''}`}>
            {lf("Line {0}: {1}", (error.endLine) ? error.endLine + 1 : error.line + 1, error.messageText)}
            </div>
        )
    }
}



// interface ErrorListItemProps {
//     error: pxtc.KsDiagnostic,
//     active: boolean,
//     onToggle: any
// }

// class ErrorListItem extends React.Component<ErrorListItemProps> {
//     constructor(props: ErrorListItemProps) {
//         super(props)

//         this.handleClick = this.handleClick.bind(this)
//     }

//     render() {
//         const e = this.props.error

//         return (
//             <div className={`errorListItem ${this.props.active ? 'active' : ''}`} >
//                 {lf("Line {0}: {1}", (e.endLine) ? e.endLine + 1 : e.line + 1, e.messageText)}
//             </div>
//         )
//     }

//     handleClick(event: any) {
//         this.props.onToggle(event.target.dataset.key)
//     }
// }