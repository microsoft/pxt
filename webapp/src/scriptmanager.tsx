/// <reference path="../../built/pxtlib.d.ts" />

import * as React from "react";
import * as data from "./data";
import * as sui from "./sui";
import * as core from "./core";
import * as workspace from "./workspace";
import * as compiler from "./compiler";
import { SearchInput } from "./components/searchInput";
import { ProjectsCodeCard } from "./projects";

type ISettingsProps = pxt.editor.ISettingsProps;

export interface ScriptManagerDialogState {
    visible?: boolean;
    selected?: pxt.Map<number>;
    markedNew?: pxt.Map<number>;
    multiSelect?: boolean;
    multiSelectStart?: number;
    view: 'list' | 'grid';
    searchFor?: string;
    results?: string;
}

export class ScriptManagerDialog extends data.Component<ISettingsProps, ScriptManagerDialogState> {
    constructor(props: ISettingsProps) {
        super(props);
        this.state = {
            visible: false,
            selected: {},
            markedNew: {},
            view: 'grid'
        }

        this.close = this.close.bind(this);
        this.handleCardClick = this.handleCardClick.bind(this);
        this.handleDelete = this.handleDelete.bind(this);
        this.handleExport = this.handleExport.bind(this);
        this.handleOpen = this.handleOpen.bind(this);
        this.handleRename = this.handleRename.bind(this);
        this.handleDuplicate = this.handleDuplicate.bind(this);
        this.handleSwitchView = this.handleSwitchView.bind(this);
        this.handleSearch = this.handleSearch.bind(this);
    }

    hide() {
        this.setState({ visible: false, searchFor: undefined });
    }

    close() {
        this.setState({ visible: false, searchFor: undefined });
    }

    show() {
        this.setState({ visible: true });
    }

    fetchLocalData(): pxt.workspace.Header[] {
        let headers: pxt.workspace.Header[] = this.getData(`headers:${this.state.searchFor || ''}`);
        return headers;
    }

    handleCardClick(e: any, scr: any, index?: number, force?: boolean) {
        const shifted = e.shiftKey;
        const ctrlCmd = force || (pxt.BrowserUtils.isMac() ? e.metaKey : e.ctrlKey);
        let { selected, multiSelect, multiSelectStart } = this.state;
        if (shifted && ctrlCmd) return;
        if (ctrlCmd) {
            selected[index] = selected[index] ? 0 : 1;
            if (selected[index]) multiSelectStart = index;
        }
        else if (shifted) {
            selected = {};
            // Use the start position to select all the projects in between
            for (let i = Math.min(index, multiSelectStart); i <= Math.max(index, multiSelectStart); i++) {
                selected[i] = 1;
            }
            multiSelect = true;
        } else if (multiSelect) {
            selected = {};
            multiSelect = false;
        }
        if (!shifted && !ctrlCmd) {
            if (Object.keys(selected).length == 1 && selected[index]) {
                // Deselect the currently selected card if we click on it again
                delete selected[index];
            }
            else {
                selected = {};
                selected[index] = 1;
                // Use this as a previous indicator
                multiSelectStart = index;
            }
        }
        this.setState({ selected, multiSelect, multiSelectStart });

        e.stopPropagation();
        e.preventDefault();
    }

    handleDelete() {
        let { selected } = this.state;
        const headers = this.fetchLocalData();
        const selectedLength = Object.keys(selected).length;
        core.confirmDelete(selectedLength == 1 ? headers[selected[Object.keys(selected)[0]]].name : lf("{0} files", selectedLength), () => {
            const promises: Promise<void>[] = [];
            headers.forEach((header, index) => {
                if (selected[index]) {
                    // Delete each selected project
                    header.isDeleted = true;
                    promises.push(workspace.saveAsync(header, {}));
                }
            })
            this.setState({ selected: {} })
            return Promise.all(promises).then(() => { });
        })
    }

    handleExport() {
        // TODO: handle saving to file
        // Possibly handle saving multiple files (.zip?)
    }

    handleOpen() {
        const header = this.getSelectedHeader();

        core.showLoading("changeheader", lf("loading..."));
        this.props.parent.loadHeaderAsync(header)
            .done(() => {
                core.hideLoading("changeheader");
            })
    }

    handleRename() {
        const header = this.getSelectedHeader();
        // TODO: implement renaming without opening project
    }

    handleDuplicate() {
        const header = this.getSelectedHeader();
        // Ask for the new project name
        const opts: core.PromptOptions = {
            header: lf("Choose a new name for your project"),
            agreeLbl: lf("Clone"),
            agreeClass: "green approve positive",
            agreeIcon: "clone",
            initialValue: this.createDuplicateName(header.name),
            placeholder: lf("Enter your project name here")
        };
        return core.promptAsync(opts).then(res => {
            if (res === null) return Promise.resolve(false); // null means cancelled, empty string means ok (but no value entered)
            // Clone the existing header
            const clonedHeader = pxt.U.clone(header);
            // Clear some fields
            clonedHeader.id = undefined;
            clonedHeader.meta = {};
            clonedHeader.pubId = "";
            clonedHeader.pubCurrent = false;
            return workspace.getTextAsync(header.id)
                .then(files => {
                    // Update the name in the header
                    clonedHeader.name = res;
                    // Update the name in the pxt.json (config)
                    let config = JSON.parse(files[pxt.CONFIG_NAME]) as pxt.PackageConfig;
                    config.name = clonedHeader.name;
                    files[pxt.CONFIG_NAME] = JSON.stringify(config, null, 4) + "\n";
                    return workspace.installAsync(clonedHeader, files);
                })
                .then(() => workspace.saveAsync(clonedHeader))
                .then(() => {
                    data.clearCache();
                    this.setState({ selected: {}, markedNew: { '0': 1 } });
                    setTimeout(() => {
                        this.setState({ markedNew: {} });
                    }, 5 * 1000);
                    return true;
                })
        });
    }

    private createDuplicateName(initialName: string) {
        return initialName;
    }

    handleSwitchView() {
        const newView = this.state.view == 'grid' ? 'list' : 'grid';
        this.setState({ view: newView });
    }

    handleSearch(inputValue: string) {
        this.setState({ searchFor: inputValue, selected: {} }); // Clear selected list when searching
    }

    handleKeyDown = (e: React.KeyboardEvent<any>) => {
        const charCode = core.keyCodeFromEvent(e);
        const ctrlCmd = pxt.BrowserUtils.isMac() ? e.metaKey : e.ctrlKey;
        if (ctrlCmd && charCode === 65 /* a */) {
            this.handleSelectAll(e);
        }
    }

    handleAreaClick = () => {
        this.setState({ selected: {} });
    }

    handleSelectAll = (event: any) => {
        let { selected } = this.state;
        const headers = this.fetchLocalData();
        const selectedAll = headers.length > 0 && headers.length == Object.keys(selected).length;
        if (selectedAll) {
            // Deselect all if selected
            selected = {};
        } else {
            // Select all
            headers.forEach((header, index) => {
                selected[index] = 1;
            })
        }
        this.setState({ selected });
        event.stopPropagation();
        event.preventDefault();
    }

    private getSelectedHeader() {
        const { selected } = this.state;
        const indexes = Object.keys(selected);
        if (indexes.length !== 1) return null; // Sanity check
        const index = parseInt(indexes[0]);
        const headers = this.fetchLocalData();
        return headers[index];
    }

    renderCore() {
        const { visible, selected, markedNew, view, searchFor } = this.state;
        if (!visible) return <div></div>;

        let headers = this.fetchLocalData() || [];
        headers = headers.filter(h => !h.isDeleted);
        const isSearching = false;

        const selectedAll = headers.length > 0 && headers.length == Object.keys(selected).length;

        let headerActions: JSX.Element[] = [];
        headerActions.push(<SearchInput key="search"
            ariaMessage={lf("{0} result matching '{1}'", headers.length, searchFor)}
            placeholder={lf("Search...")} className="mobile hide"
            searchHandler={this.handleSearch}
            disabled={isSearching}
            style={{ flexGrow: 1 }}
            searchOnChange={true}
        />);
        if (Object.keys(selected).length > 0) {
            if (Object.keys(selected).length == 1) {
                headerActions.push(<sui.Button key="edit" icon="edit outline" className="icon"
                    title={lf("Edit Project")} onClick={this.handleOpen} tooltipId={"scriptmgr-actions-edit"} />);
                //headerActions.push(<sui.Button key="rename" icon="font" className="circular icon" title={lf("Rename Project")} onClick={this.handleRename} />);
                headerActions.push(<sui.Button key="clone" icon="clone outline" className="icon"
                    title={lf("Clone Project")} onClick={this.handleDuplicate} tooltipId={"scriptmgr-actions-clone"} />);
                //headerActions.push(<sui.Button key="export" icon="download" className="circular icon" title={lf("Save Project")} onClick={this.handleExport} />);
            }
            headerActions.push(<sui.Button key="delete" icon="trash" className="icon red"
                title={lf("Delete Project")} onClick={this.handleDelete} tooltipId={"scriptmgr-actions-delete"} />);
            headerActions.push(<div key="divider" className="divider"></div>);
        }
        headerActions.push(<sui.Button key="view" icon={view == 'grid' ? 'th list' : 'grid layout'} className="icon"
            title={`${view == 'grid' ? lf("List view") : lf("Grid view")}`} onClick={this.handleSwitchView} tooltipId={"scriptmgr-actions-switchview"} />)

        /* tslint:disable:react-a11y-anchors */
        return (
            <sui.Modal isOpen={visible} className="scriptmanagerdialog" size="fullscreen"
                onClose={this.close} dimmer={true} header={lf("My Projects")}
                closeIcon={true} headerActions={headerActions}
                closeOnDimmerClick closeOnDocumentClick closeOnEscape
            >
                {view == 'grid' ?
                    <div role="grid" className="ui container fluid" style={{ height: "100%" }} onClick={this.handleAreaClick} onKeyDown={this.handleKeyDown}>
                        <div className={"ui cards"}>
                            {headers.map((scr, index) => {
                                const isMarkedNew = !!markedNew[index];
                                const isSelected = !!selected[index];
                                const showMarkedNew = isMarkedNew && !isSelected;

                                let labelIcon = `circle outline ${isSelected ? 'check' : ''} ${isSelected ? 'green' : 'grey'}`;
                                if (showMarkedNew) labelIcon = undefined;
                                const labelClass = showMarkedNew ? 'orange right ribbon label' :
                                    `right corner label large selected-label`;
                                const label = showMarkedNew ? lf("New") : undefined;

                                return <ProjectsCodeCard
                                    key={'local' + scr.id + scr.recentUse}
                                    cardType="file"
                                    className={`file ${isMarkedNew ? 'warning' : isSelected ? 'positive' : ''}`}
                                    name={scr.name}
                                    time={scr.recentUse}
                                    url={scr.pubId && scr.pubCurrent ? "/" + scr.pubId : ""}
                                    scr={scr} index={index}
                                    labelIcon={labelIcon}
                                    labelClass={labelClass}
                                    label={label}
                                    onCardClick={this.handleCardClick}
                                />
                            })}
                        </div>
                    </div> : undefined}
                {view == 'list' ?
                    <div role="table" className="ui container" style={{ height: "100%" }} onClick={this.handleAreaClick} onKeyDown={this.handleKeyDown}>
                        <table className="ui definition unstackable table">
                            <thead className="full-width">
                                <tr>
                                    <th onClick={this.handleSelectAll} tabIndex={0} onKeyDown={sui.fireClickOnEnter}>
                                        <sui.Icon icon={`circle outline large ${selectedAll ? 'check' : ''}`} />
                                    </th>
                                    <th>Name</th>
                                    <th>Updated</th>
                                </tr>
                            </thead>
                            <tbody>
                                {headers.map((scr, index) => {
                                    const isMarkedNew = !!markedNew[index];
                                    const isSelected = !!selected[index];
                                    const showMarkedNew = isMarkedNew && !isSelected;

                                    return <ProjectsCodeRow key={'local' + scr.id + scr.recentUse} selected={isSelected}
                                        onRowClicked={this.handleCardClick} index={index}
                                        scr={scr} markedNew={showMarkedNew}>
                                        <td>{scr.name}</td>
                                        <td>{pxt.Util.timeSince(scr.recentUse)}</td>
                                    </ProjectsCodeRow>
                                })}
                            </tbody>
                        </table>
                    </div>
                    : undefined}
            </sui.Modal>
        )
    }
}


interface ProjectsCodeRowProps extends pxt.CodeCard {
    scr: any;
    index?: number;
    selected?: boolean;
    markedNew?: boolean;
    onRowClicked: (e: any, scr: any, index?: number, force?: boolean) => void;
}

class ProjectsCodeRow extends sui.StatelessUIElement<ProjectsCodeRowProps> {

    constructor(props: ProjectsCodeRowProps) {
        super(props);

        this.handleClick = this.handleClick.bind(this);
        this.handleCheckboxClick = this.handleCheckboxClick.bind(this);
    }

    handleClick(e: any) {
        this.props.onRowClicked(e, this.props.scr, this.props.index);
    }

    handleCheckboxClick(e: any) {
        this.props.onRowClicked(e, this.props.scr, this.props.index, true);
        e.preventDefault();
        e.stopPropagation();
    }


    renderCore() {
        const { scr, onRowClicked, onClick, selected, markedNew, children, ...rest } = this.props;
        return <tr tabIndex={0} {...rest} onKeyDown={sui.fireClickOnEnter} onClick={this.handleClick} style={{ cursor: 'pointer' }} className={`${markedNew ? 'warning' : selected ? 'positive' : ''}`}>
            <td className="collapsing" onClick={this.handleCheckboxClick}>
                <sui.Icon icon={`circle outline large ${selected ? 'check' : ''}`} />
            </td>
            {children}
        </tr>
    }
}
