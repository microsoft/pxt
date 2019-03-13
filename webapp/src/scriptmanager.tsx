import * as React from "react";
import * as data from "./data";
import * as sui from "./sui";
import * as core from "./core";
import * as workspace from "./workspace";
import * as compiler from "./compiler";

import { SearchInput } from "./components/searchInput";
import { ProjectsCodeCard } from "./projects";

type ISettingsProps = pxt.editor.ISettingsProps;

export interface ScriptManagerDialogProps extends ISettingsProps {
    onClose?: () => void;
}

export interface ScriptManagerDialogState {
    visible?: boolean;
    selected?: pxt.Map<number>;
    markedNew?: pxt.Map<number>;
    multiSelect?: boolean;
    multiSelectStart?: number;
    view: 'list' | 'grid';
    searchFor?: string;
    results?: string;

    sortedBy?: string;
    sortedAsc?: boolean;
}

export class ScriptManagerDialog extends data.Component<ScriptManagerDialogProps, ScriptManagerDialogState> {
    constructor(props: ScriptManagerDialogProps) {
        super(props);
        this.state = {
            visible: false,
            selected: {},
            markedNew: {},
            view: 'grid',
            sortedBy: 'time',
            sortedAsc: false
        }

        this.close = this.close.bind(this);
        this.handleCardClick = this.handleCardClick.bind(this);
        this.handleDelete = this.handleDelete.bind(this);
        this.handleOpen = this.handleOpen.bind(this);
        this.handleDuplicate = this.handleDuplicate.bind(this);
        this.handleSwitchView = this.handleSwitchView.bind(this);
        this.handleSearch = this.handleSearch.bind(this);
        this.handleCheckboxClick = this.handleCheckboxClick.bind(this);
    }

    hide() {
        this.setState({ visible: false, searchFor: undefined });
    }

    close() {
        this.setState({ visible: false, searchFor: undefined });
        if (this.props.onClose) this.props.onClose();
    }

    show() {
        this.setState({ visible: true });
        compiler.projectSearchClear();
    }

    fetchLocalData(): pxt.workspace.Header[] {
        let headers: pxt.workspace.Header[] = this.getData(`headers:${this.state.searchFor || ''}`);
        return headers;
    }

    handleCardClick(e: any, scr: any, index?: number, force?: boolean) {
        const shifted = e.shiftKey;
        const ctrlCmd = (force && !shifted) || (pxt.BrowserUtils.isMac() ? e.metaKey : e.ctrlKey);
        let { selected, multiSelect, multiSelectStart } = this.state;
        if (shifted && ctrlCmd) return;
        // If ctrl/cmd is down, toggle from the list
        if (ctrlCmd) {
            if (selected[index]) delete selected[index];
            else selected[index] = 1;
            if (selected[index]) multiSelectStart = index;
        }
        else if (shifted) {
            selected = {};
            // Shift is down, use the start position to select all the projects in between
            for (let i = Math.min(index, multiSelectStart); i <= Math.max(index, multiSelectStart); i++) {
                selected[i] = 1;
            }
            multiSelect = true;
        } else if (multiSelect) {
            // Clear multi select state
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
                // Use this as an indicator for any future multi-select clicks
                multiSelectStart = index;
            }
        }
        this.setState({ selected, multiSelect, multiSelectStart });

        e.stopPropagation();
        e.preventDefault();
    }

    handleCheckboxClick(e: any, scr: any, index?: number) {
        this.handleCardClick(e, scr, index, true);
        e.preventDefault();
        e.stopPropagation();
    }

    handleDelete() {
        let { selected } = this.state;
        const headers = this.getSortedHeaders();
        const selectedLength = Object.keys(selected).length;
        core.confirmDelete(selectedLength == 1 ? headers[parseInt(Object.keys(selected)[0])].name : selectedLength.toString(), () => {
            const promises: Promise<void>[] = [];
            headers.forEach((header, index) => {
                if (selected[index]) {
                    // Delete each selected project
                    header.isDeleted = true;
                    promises.push(workspace.saveAsync(header, {}));
                }
            })
            this.setState({ selected: {} })
            return Promise.all(promises)
                .then(() => {
                    data.clearCache();
                });
        }, selectedLength > 1);
    }

    handleOpen() {
        const header = this.getSelectedHeader();

        core.showLoading("changeheader", lf("loading..."));
        this.props.parent.loadHeaderAsync(header)
            .done(() => {
                core.hideLoading("changeheader");
            })
    }

    handleDuplicate() {
        const header = this.getSelectedHeader();
        // Prompt for the new project name
        const opts: core.PromptOptions = {
            header: lf("Choose a new name for your project"),
            agreeLbl: lf("Duplicate"),
            agreeClass: "green approve positive",
            agreeIcon: "clone",
            initialValue: workspace.createDuplicateName(header),
            placeholder: lf("Enter your project name here")
        };
        return core.promptAsync(opts).then(res => {
            if (res === null) return Promise.resolve(false); // null means cancelled, empty string means ok (but no value entered)
            let files: pxt.Map<string>;
            return workspace.getTextAsync(header.id)
                .then(text => {
                    files = text;
                    // Duplicate the existing header
                    return workspace.duplicateAsync(header, text, false);
                })
                .then((clonedHeader) => {
                    // Update the name of the new header
                    clonedHeader.name = res;
                    // Set the name in the pxt.json (config)
                    let cfg = JSON.parse(files[pxt.CONFIG_NAME]) as pxt.PackageConfig
                    cfg.name = clonedHeader.name
                    files[pxt.CONFIG_NAME] = JSON.stringify(cfg, null, 4);
                    return clonedHeader;
                })
                .then((clonedHeader) => workspace.saveAsync(clonedHeader, files))
                .then(() => {
                    data.invalidate("headers:");
                    data.invalidate(`headers:${this.state.searchFor}`);
                    this.setState({ selected: {}, markedNew: { '0': 1 }, sortedBy: 'time', sortedAsc: false });
                    setTimeout(() => {
                        this.setState({ markedNew: {} });
                    }, 5 * 1000);
                    return true;
                });
        });
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
        const headers = this.getSortedHeaders();
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

    toggleSortName = (force?: boolean) => {
        let { sortedBy, sortedAsc } = this.state;
        if (sortedBy == 'name' && !force) sortedAsc = !sortedAsc
        else sortedAsc = true; // Default asc
        this.setState({ sortedBy: 'name', sortedAsc, markedNew: {}, selected: {} });
    }

    toggleSortTime = (force?: boolean) => {
        let { sortedAsc, sortedBy } = this.state;
        if (sortedBy == 'time' && !force) sortedAsc = !sortedAsc
        else sortedAsc = false; // Default desc
        this.setState({ sortedBy: 'time', sortedAsc, markedNew: {}, selected: {} });
    }

    handleSortName = () => {
        this.toggleSortName(true);
    }

    handleSortTime = () => {
        this.toggleSortTime(true);
    }

    handleToggleSortName = () => {
        this.toggleSortName(false);
    }

    handleToggleSortTime = () => {
        this.toggleSortTime(false);
    }

    handleSwitchSortDirection = () => {
        const { sortedAsc } = this.state;
        this.setState({ sortedAsc: !sortedAsc, markedNew: {}, selected: {} });
    }

    private getSelectedHeader() {
        const { selected } = this.state;
        const indexes = Object.keys(selected);
        if (indexes.length !== 1) return null; // Sanity check
        const index = parseInt(indexes[0]);
        const headers = this.getSortedHeaders();
        return headers[index];
    }

    private getSortedHeaders() {
        const { sortedBy, sortedAsc } = this.state;
        const headers = this.fetchLocalData() || [];
        return headers.sort(this.getSortingFunction(sortedBy, sortedAsc))
    }

    private getSortingFunction(sortedBy: string, sortedAsc: boolean) {
        const sortingFunction = (a: pxt.workspace.Header, b: pxt.workspace.Header) => {
            if (sortedBy === 'time') {
                return sortedAsc ?
                    a.modificationTime - b.modificationTime :
                    b.modificationTime - a.modificationTime;
            }
            return sortedAsc ?
                a.name.localeCompare(b.name) :
                b.name.localeCompare(a.name);
        };
        return sortingFunction;
    }

    renderCore() {
        const { visible, selected, markedNew, view, searchFor, sortedBy, sortedAsc } = this.state;
        if (!visible) return <div></div>;

        const darkTheme = pxt.appTarget.appTheme.baseTheme == 'dark';

        let headers = this.getSortedHeaders() || [];
        headers = headers.filter(h => !h.isDeleted);
        const isSearching = false;
        const hasHeaders = !searchFor ? headers.length > 0 : true;
        const selectedAll = headers.length > 0 && headers.length == Object.keys(selected).length;

        let headerActions: JSX.Element[];
        if (hasHeaders) {
            headerActions = [];
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
                        text={lf("Open")} textClass="landscape only" title={lf("Open Project")} onClick={this.handleOpen} />);
                    headerActions.push(<sui.Button key="clone" icon="clone outline" className="icon"
                        text={lf("Duplicate")} textClass="landscape only" title={lf("Duplicate Project")} onClick={this.handleDuplicate} />);
                }
                headerActions.push(<sui.Button key="delete" icon="trash" className="icon red"
                    text={lf("Delete")} textClass="landscape only" title={lf("Delete Project")} onClick={this.handleDelete} />);
                headerActions.push(<div key="divider" className="divider"></div>);
            }
            headerActions.push(<sui.Button key="view" icon={view == 'grid' ? 'th list' : 'grid layout'} className="icon"
                title={`${view == 'grid' ? lf("List view") : lf("Grid view")}`} onClick={this.handleSwitchView} />)
        }
        return (
            <sui.Modal isOpen={visible} className="scriptmanager" size="fullscreen"
                onClose={this.close} dimmer={true} header={lf("My Projects")}
                closeIcon={true} headerActions={headerActions}
                closeOnDimmerClick closeOnDocumentClick closeOnEscape
            >
                {!hasHeaders ? <div className="empty-content">
                    <h2 className={`ui center aligned header ${darkTheme ? "inverted" : ""}`}>
                        <div className="content">
                            {lf("It's empty in here")}
                            <div className="sub header">{lf("Go back to create a new project")}</div>
                        </div>
                    </h2>
                </div> : undefined}
                {hasHeaders && view == 'grid' ?
                    <div role="grid" className="ui container fluid" style={{ height: "100%" }} onClick={this.handleAreaClick} onKeyDown={this.handleKeyDown}>
                        <div className="sort-by">
                            <div className="ui compact buttons">
                                <sui.DropdownMenu role="menuitem" text={sortedBy == 'time' ? lf("Last Modified") : lf("Name")} title={lf("Sort by dropdown")} className={`inline button ${darkTheme ? 'inverted' : ''}`}>
                                    <sui.Item role="menuitem" icon={sortedBy == 'name' ? 'check' : undefined} className={`${sortedBy != 'name' ? 'no-icon' : ''} ${darkTheme ? 'inverted' : ''}`} text={lf("Name")} tabIndex={-1} onClick={this.handleSortName} />
                                    <sui.Item role="menuitem" icon={sortedBy == 'time' ? 'check' : undefined} className={`${sortedBy != 'time' ? 'no-icon' : ''} ${darkTheme ? 'inverted' : ''}`} text={lf("Last Modified")} tabIndex={-1} onClick={this.handleSortTime} />
                                </sui.DropdownMenu>
                                <sui.Button icon={`arrow ${sortedAsc ? 'up' : 'down'}`} className={`${darkTheme ? 'inverted' : ''}`} onClick={this.handleSwitchSortDirection} title={lf("Switch sort order to {0}", !sortedAsc ? lf("ascending") : lf("descending"))} />
                            </div>
                        </div>
                        <div className={"ui cards"}>
                            {headers.sort(this.getSortingFunction(sortedBy, sortedAsc)).map((scr, index) => {
                                const isMarkedNew = !!markedNew[index];
                                const isSelected = !!selected[index];
                                const showMarkedNew = isMarkedNew && !isSelected;

                                let labelIcon = `circle outline ${isSelected ? 'check' : ''} ${isSelected ? 'green' : 'grey'} ${darkTheme ? 'inverted' : ''}`;
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
                                    onLabelClick={this.handleCheckboxClick}
                                />
                            })}
                        </div>
                    </div> : undefined}
                {hasHeaders && view == 'list' ?
                    <div role="table" className="ui container" style={{ height: "100%" }} onClick={this.handleAreaClick} onKeyDown={this.handleKeyDown}>
                        <table className={`ui definition unstackable table ${darkTheme ? 'inverted' : ''}`}>
                            <thead className="full-width">
                                <tr>
                                    <th onClick={this.handleSelectAll} tabIndex={0} onKeyDown={sui.fireClickOnEnter} title={selectedAll ? lf("De-select all projects") : lf("Select all projects")} style={{ cursor: 'pointer' }}>
                                        <sui.Icon icon={`circle outline large ${selectedAll ? 'check' : ''}`} />
                                    </th>
                                    <th onClick={this.handleToggleSortName} tabIndex={0} onKeyDown={sui.fireClickOnEnter} title={lf("Sort by Name {0}", sortedAsc ? lf("ascending") : lf("descending"))} style={{ cursor: 'pointer' }}>
                                        {lf("Name")} {sortedBy == 'name' ? <sui.Icon icon={`arrow ${sortedAsc ? 'up' : 'down'}`} /> : undefined}
                                    </th>
                                    <th onClick={this.handleToggleSortTime} tabIndex={0} onKeyDown={sui.fireClickOnEnter} title={lf("Sort by Last Modified {0}", sortedAsc ? lf("ascending") : lf("descending"))} style={{ cursor: 'pointer' }}>
                                        {lf("Last Modified")} {sortedBy == 'time' ? <sui.Icon icon={`arrow ${sortedAsc ? 'up' : 'down'}`} /> : undefined}
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {headers.sort(this.getSortingFunction(sortedBy, sortedAsc)).map((scr, index) => {
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
                <sui.Icon icon={`circle outline large ${selected ? `check green` : markedNew ? 'black' : ''}`} />
            </td>
            {children}
        </tr>
    }
}
