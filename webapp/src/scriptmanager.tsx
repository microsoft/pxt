import * as React from "react";
import * as data from "./data";
import * as sui from "./sui";
import * as core from "./core";
import * as workspace from "./workspace";
import * as compiler from "./compiler";
import * as auth from "./auth";

import { SearchInput } from "./components/searchInput";
import { ProjectsCodeCard } from "./projects";
import { fireClickOnEnter } from "./util";
import { Modal } from "../../react-common/components/controls/Modal";
import { ProgressBar } from "./dialogs";
import { classList } from "../../react-common/components/util";

declare const zip: any;

let loadZipJsPromise: Promise<boolean>;
export function loadZipAsync(): Promise<boolean> {
    if (!loadZipJsPromise)
        loadZipJsPromise = pxt.BrowserUtils.loadScriptAsync("zip.js/zip.min.js")
            .then(() => typeof zip !== "undefined")
            .catch(e => false)
    return loadZipJsPromise;
}

type ISettingsProps = pxt.editor.ISettingsProps;

export type ScriptSource = 'cloud' | 'local';

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

    download?: DownloadProgress;
}

interface DownloadProgress {
    completed: number;
    max: number;
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
        this.handleOpenNewTab = this.handleOpenNewTab.bind(this);
        this.handleOpenNewLinkedTab = this.handleOpenNewLinkedTab.bind(this);
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

    handleCardClick(e: any, scr: any, index?: number, id?: string, force?: boolean) {
        const shifted = e.shiftKey;
        const ctrlCmd = (force && !shifted) || (pxt.BrowserUtils.isMac() ? e.metaKey : e.ctrlKey);
        let { selected, multiSelect, multiSelectStart } = this.state;
        if (shifted && ctrlCmd) return;
        // If ctrl/cmd is down, toggle from the list
        if (ctrlCmd) {
            if (selected[id]) delete selected[id];
            else selected[id] = 1;
            if (selected[id]) multiSelectStart = index;
        }
        else if (shifted) {
            const items = this.getSortedHeaders();
            selected = {};
            // Shift is down, use the start position to select all the projects in between
            for (let i = Math.min(index, multiSelectStart); i <= Math.max(index, multiSelectStart); i++) {
                selected[this.getId(items[i])] = 1;
            }
            multiSelect = true;
        } else if (multiSelect) {
            // Clear multi select state
            selected = {};
            multiSelect = false;
        }
        if (!shifted && !ctrlCmd) {
            if (Object.keys(selected).length == 1 && selected[id]) {
                // Deselect the currently selected card if we click on it again
                delete selected[id];
            }
            else {
                selected = {};
                selected[id] = 1;
                // Use this as an indicator for any future multi-select clicks
                multiSelectStart = index;
            }
        }
        this.setState({ selected, multiSelect, multiSelectStart });

        e.stopPropagation();
        e.preventDefault();
    }

    handleCheckboxClick(e: any, scr: any, index?: number, id?: string) {
        this.handleCardClick(e, scr, index, id, true);
        e.preventDefault();
        e.stopPropagation();
    }

    handleDelete() {
        let { selected } = this.state;
        const headers = this.getSortedHeaders();
        const selectedLength = Object.keys(selected).length;
        core.confirmDelete(selectedLength == 1 ? headers.find((h) => Object.keys(selected)[0].includes(h.id)).name
                                               : selectedLength.toString(), () => {
            const promises: Promise<void>[] = [];
            headers.forEach((header, index) => {
                if (selected[this.getId(header)]) {
                    // Delete each selected project
                    header.isDeleted = true;
                    promises.push(workspace.forceSaveAsync(header, {}));
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
        pxt.tickEvent("scriptmanager.open", undefined, { interactiveConsent: true });
        const header = this.getSelectedHeader();

        core.showLoading("changeheader", lf("loading..."));
        this.props.parent.loadHeaderAsync(header)
            .then(() => {
                core.hideLoading("changeheader");
            })
    }

    handleOpenNewTab() {
        pxt.tickEvent("scriptmanager.newtab", undefined, { interactiveConsent: true });
        const header = this.getSelectedHeader();
        this.props.parent.openNewTab(header, false);
    }

    handleOpenNewLinkedTab() {
        pxt.tickEvent("scriptmanager.newlinkedtab", undefined, { interactiveConsent: true });
        const header = this.getSelectedHeader();
        this.props.parent.openNewTab(header, true);
    }

    handleDuplicate() {
        pxt.tickEvent("scriptmanager.dup", undefined, { interactiveConsent: true });
        const header = this.getSelectedHeader();
        // Prompt for the new project name
        const opts: core.PromptOptions = {
            header: lf("Choose a new name for your project"),
            agreeLbl: lf("Duplicate"),
            agreeClass: "green approve positive",
            agreeIcon: "clone",
            initialValue: workspace.createDuplicateName(header),
            placeholder: lf("Enter your project name here"),
            size: "tiny"
        };
        return core.promptAsync(opts).then(res => {
            if (res === null)
                return false; // null means cancelled
            let id: string;
            return workspace.duplicateAsync(header, res)
                .then(clonedHeader => {
                    id = this.getId(clonedHeader);
                    return workspace.saveAsync(clonedHeader);
                })
                .then(() => {
                    data.invalidate(`headers:${this.state.searchFor}`);
                    this.setState({ selected: {}, markedNew: { [id]: 1 }, sortedBy: 'time', sortedAsc: false });
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
                selected[this.getId(header)] = 1;
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
        this.setState({ sortedBy: 'name', sortedAsc });
    }

    toggleSortTime = (force?: boolean) => {
        let { sortedAsc, sortedBy } = this.state;
        if (sortedBy == 'time' && !force) sortedAsc = !sortedAsc
        else sortedAsc = false; // Default desc
        this.setState({ sortedBy: 'time', sortedAsc });
    }

    handleSortName: React.MouseEventHandler = e => {
        e.stopPropagation();
        this.toggleSortName(true);
    }

    handleSortTime: React.MouseEventHandler = e => {
        e.stopPropagation();
        this.toggleSortTime(true);
    }

    handleToggleSortName: React.MouseEventHandler = e => {
        e.stopPropagation();
        this.toggleSortName(false);
    }

    handleToggleSortTime: React.MouseEventHandler = e => {
        e.stopPropagation();
        this.toggleSortTime(false);
    }

    handleSwitchSortDirection: React.MouseEventHandler = e => {
        e.stopPropagation();
        const { sortedAsc } = this.state;
        this.setState({ sortedAsc: !sortedAsc });
    }

    handleDownloadAsync = async () => {
        pxt.tickEvent("scriptmanager.downloadZip", undefined, { interactiveConsent: true });

        await loadZipAsync();

        const { selected } = this.state;
        const zipWriter = new zip.ZipWriter(new zip.Data64URIWriter("application/zip"));
        const selectedHeaders = this.getSortedHeaders().filter(h => selected[this.getId(h)]);

        let done = 0;

        const takenNames: {[index: string]: boolean} = {};

        const format = (val: number, len = 2) => {
            let out = val + "";
            while (out.length < len) {
                out = "0" + out
            }

            return out.substring(0, len);
        }

        this.setState({
            download: {
                completed: 0,
                max: selectedHeaders.length
            }
        });

        const targetNickname = pxt.appTarget.nickname || pxt.appTarget.id;

        for (const header of selectedHeaders) {
            const text = await workspace.getTextAsync(header.id);

            let preferredEditor = "blocksprj";
            try {
                const config = JSON.parse(text["pxt.json"]) as pxt.PackageConfig;

                preferredEditor = config.preferredEditor || "blocksprj"
            }
            catch (e) {
                // ignore invalid configs
            }

            const project: pxt.cpp.HexFile = {
                meta: {
                    cloudId: pxt.CLOUD_ID + pxt.appTarget.id,
                    targetVersions: pxt.appTarget.versions,
                    editor: preferredEditor,
                    name: header.name
                },
                source: JSON.stringify(text, null, 2)
            };

            const compressed = await pxt.lzmaCompressAsync(JSON.stringify(project, null, 2));

            /* eslint-disable no-control-regex */
            let sanitizedName = header.name.replace(/[()\\\/.,?*^:<>!;'#$%^&|"@+=«»°{}\[\]¾½¼³²¦¬¤¢£~­¯¸`±\x00-\x1F]/g, '');
            sanitizedName = sanitizedName.trim().replace(/\s+/g, '-');
            /* eslint-enable no-control-regex */

            if (pxt.appTarget.appTheme && pxt.appTarget.appTheme.fileNameExclusiveFilter) {
                const rx = new RegExp(pxt.appTarget.appTheme.fileNameExclusiveFilter, 'g');
                sanitizedName = sanitizedName.replace(rx, '');
            }

            if (!sanitizedName) {
                sanitizedName = "Untitled"; // do not translate to avoid unicode issues
            }

            // Include the recent use time in the filename
            const date = new Date(header.recentUse * 1000);
            const dateSnippet = `${date.getFullYear()}-${format(date.getMonth())}-${format(date.getDate())}`

            // FIXME: handle different date formatting?
            let fn = `${targetNickname}-${dateSnippet}-${sanitizedName}.mkcd`;

            // zip.js can't handle multiple files with the same name
            if (takenNames[fn]) {
                let index = 2;
                do {
                    fn = `${targetNickname}-${dateSnippet}-${sanitizedName}${index}.mkcd`
                    index ++;
                } while(takenNames[fn])
            }

            takenNames[fn] = true;

            await zipWriter.add(fn, new zip.Uint8ArrayReader(compressed));

            // Check for cancellation
            if (!this.state.download) return;

            done++;
            this.setState({
                download: {
                    completed: done,
                    max: selectedHeaders.length
                }
            });
        }

        const datauri = await zipWriter.close();

        const zipName = `makecode-${targetNickname}-project-download.zip`

        pxt.BrowserUtils.browserDownloadDataUri(datauri, zipName);

        this.setState({
            download: null
        });
    }

    handleDownloadProgressClose = () => {
        this.setState({
            download: null
        });
    }

    private getSelectedHeader() {
        const { selected } = this.state;
        const indexes = Object.keys(selected);
        if (indexes.length !== 1) return null; // Sanity check
        const id = Object.keys(selected)[0];
        const headers = this.fetchLocalData()
        return headers.find((h) => id.includes(h.id))
    }

    private getSortedHeaders() {
        const { sortedBy, sortedAsc, searchFor } = this.state;
        const headers = (this.fetchLocalData() || [])
            .filter(h => !h.tutorial?.metadata?.hideIteration);

        // Already sorted by relevance
        if (searchFor?.trim()) {
            return headers;
        }
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

    private getId(scr: pxt.workspace.Header) {
        return 'local' + scr.id + scr.recentUse;
    }

    renderCore() {
        const { visible, selected, markedNew, view, searchFor, sortedBy, sortedAsc, download } = this.state;
        if (!visible) return <div></div>;

        const darkTheme = pxt.appTarget.appTheme.baseTheme == 'dark';

        let headers = this.getSortedHeaders() || [];
        headers = headers.filter(h => !h.isDeleted);
        const isSearching = false;
        const sortedBySearch = !!searchFor?.trim();
        const hasHeaders = !searchFor ? headers.length > 0 : true;
        const selectedAll = headers.length > 0 && headers.length == Object.keys(selected).length;
        const openNewTab = pxt.appTarget.appTheme.openProjectNewTab
            && !pxt.BrowserUtils.isElectron()
            && !pxt.BrowserUtils.isIOS();
        const openDependent = openNewTab
            && pxt.appTarget.appTheme.openProjectNewDependentTab
            && !/nestededitorsim=1/.test(window.location.href); // don't nest dependent editors

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

            const numSelected = Object.keys(selected).length
            if (numSelected > 0) {
                if (numSelected == 1) {
                    const openBtn = <sui.Button key="edit" icon="edit outline" className="icon"
                        text={lf("Open")} textClass="landscape only" title={lf("Open Project")} onClick={this.handleOpen} />;
                    if (!openNewTab)
                        headerActions.push(openBtn);
                    else headerActions.push(<div className="ui buttons">{openBtn}
                        <sui.DropdownMenu className="floating button" icon="dropdown">
                            <sui.Item key="editnewtab" icon="external alternate" className="icon"
                                text={lf("New Tab")} title={lf("Open Project in a new tab")} onClick={this.handleOpenNewTab} />
                            {openDependent && <sui.Item key="editnewlinkedtab" icon="external alternate" className="icon"
                                text={lf("New Connected Tab")} title={lf("Open Project in a new tab with a connected simulator")} onClick={this.handleOpenNewLinkedTab} />}
                        </sui.DropdownMenu>
                    </div>);
                    headerActions.push(<sui.Button key="clone" icon="clone outline" className="icon"
                        text={lf("Duplicate")} textClass="landscape only" title={lf("Duplicate Project")} onClick={this.handleDuplicate} />);
                }
                headerActions.push(<sui.Button key="delete" icon="trash" className="icon red"
                    text={lf("Delete")} textClass="landscape only" title={lf("Delete Project")} onClick={this.handleDelete} />);
                if (numSelected > 1) {
                    headerActions.push(<sui.Button key="download-zip" icon="download" className="icon"
                        text={lf("Download Zip")} textClass="landscape only" title={lf("Download Zip")} onClick={this.handleDownloadAsync} />);
                }
                headerActions.push(<div key="divider" className="divider"></div>);
            }
            headerActions.push(<sui.Button key="view" icon={view == 'grid' ? 'th list' : 'grid layout'} className="icon"
                title={`${view == 'grid' ? lf("List view") : lf("Grid view")}`} onClick={this.handleSwitchView} />)
        }

        let dropdownLabel = lf("Last Modified");

        if (sortedBySearch) {
            dropdownLabel = lf("Most Relevant");
        }
        else if (sortedBy == "name") {
            dropdownLabel = lf("Name");
        }

        return (
            <sui.Modal isOpen={visible} className="scriptmanager" size="fullscreen"
                onClose={this.close} dimmer={true} header={lf("My Projects")}
                closeIcon={true} headerActions={headerActions}
                closeOnDimmerClick closeOnDocumentClick closeOnEscape
            >
                {!hasHeaders ? <div className="empty-content">
                    <h2 className={classList("ui center aligned header", darkTheme && "inverted")}>
                        <div className="content">
                            {lf("It's empty in here")}
                            <div className="sub header">{lf("Go back to create a new project")}</div>
                        </div>
                    </h2>
                </div> : undefined}
                {hasHeaders && view == 'grid' ?
                    <div role="button" className="ui container fluid" style={{ height: "100%" }} onClick={this.handleAreaClick} onKeyDown={this.handleKeyDown}>
                        <div className="sort-by">
                            <div role="menu" className="ui compact buttons">
                                <sui.DropdownMenu
                                    role="menuitem"
                                    text={dropdownLabel}
                                    title={lf("Sort by dropdown")}
                                    className={classList("inline button", darkTheme && "inverted")}
                                    displayLeft
                                    disabled={sortedBySearch}
                                >
                                    <sui.Item
                                        role="menuitem"
                                        icon={!sortedBySearch && sortedBy == 'name' ? 'check' : undefined}
                                        className={classList(!sortedBySearch && sortedBy != "name" && "no-icon", darkTheme && "inverted")}
                                        text={lf("Name")}
                                        tabIndex={-1}
                                        onClick={this.handleSortName}
                                    />
                                    <sui.Item
                                        role="menuitem"
                                        icon={!sortedBySearch && sortedBy == 'time' ? 'check' : undefined}
                                        className={classList(!sortedBySearch && sortedBy != "time" && "no-icon", darkTheme && "inverted")}
                                        text={lf("Last Modified")}
                                        tabIndex={-1}
                                        onClick={this.handleSortTime}
                                    />
                                </sui.DropdownMenu>
                                <sui.Button
                                    role="menuitem"
                                    icon={`arrow ${(sortedAsc && !sortedBySearch) ? 'up' : 'down'}`}
                                    className={`${darkTheme ? 'inverted' : ''}`}
                                    onClick={this.handleSwitchSortDirection}
                                    title={lf("Switch sort order to {0}", !sortedAsc ? lf("ascending") : lf("descending"))}
                                    disabled={sortedBySearch}
                                />
                            </div>
                        </div>
                        <div className={"ui cards"}>
                            {headers.map((scr, index) => {
                                const id = this.getId(scr);
                                const isMarkedNew = !!markedNew[id];
                                const isSelected = !!selected[id];
                                const showMarkedNew = isMarkedNew && !isSelected;

                                let labelIcon = `circle outline ${isSelected ? 'check' : ''} ${isSelected ? 'green' : 'grey'} ${darkTheme ? 'inverted' : ''}`;
                                if (showMarkedNew) labelIcon = undefined;
                                const labelClass = showMarkedNew ? 'orange right ribbon label' :
                                    `right corner label large selected-label`;
                                const label = showMarkedNew ? lf("New") : undefined;


                                // TODO name={(scr.cloudSync && scr.blobCurrent ? '(Synced) ' : '') + scr.name}
                                return <ProjectsCodeCard
                                    key={id}
                                    id={id}
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
                                    projectId={scr.id}
                                />
                            })}
                        </div>
                    </div> : undefined}
                {hasHeaders && view == 'list' ?
                    <div role="table" className="ui container" style={{ height: "100%" }} onClick={this.handleAreaClick} onKeyDown={this.handleKeyDown}>
                        <table className={`ui definition unstackable table ${darkTheme ? 'inverted' : ''}`}>
                            <thead className="full-width">
                                <tr>
                                    <th onClick={this.handleSelectAll} tabIndex={0} onKeyDown={fireClickOnEnter} title={selectedAll ? lf("De-select all projects") : lf("Select all projects")} style={{ cursor: 'pointer' }}>
                                        <sui.Icon icon={`circle outline large ${selectedAll ? 'check' : ''}`} />
                                    </th>
                                    <th onClick={this.handleToggleSortName} tabIndex={0} onKeyDown={fireClickOnEnter} title={lf("Sort by Name {0}", sortedAsc ? lf("ascending") : lf("descending"))} style={{ cursor: 'pointer' }}>
                                        {lf("Name")} {!sortedBySearch && sortedBy == 'name' && <sui.Icon icon={`arrow ${sortedAsc ? 'up' : 'down'}`} />}
                                    </th>
                                    <th onClick={this.handleToggleSortTime} tabIndex={0} onKeyDown={fireClickOnEnter} title={lf("Sort by Last Modified {0}", sortedAsc ? lf("ascending") : lf("descending"))} style={{ cursor: 'pointer' }}>
                                        {lf("Last Modified")} {!sortedBySearch && sortedBy == 'time' ? <sui.Icon icon={`arrow ${sortedAsc ? 'up' : 'down'}`} /> : undefined}
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {headers.map((scr, index) => {
                                    const id = this.getId(scr);
                                    const isMarkedNew = !!markedNew[id];
                                    const isSelected = !!selected[id];
                                    const showMarkedNew = isMarkedNew && !isSelected;

                                    return <ProjectsCodeRow key={id} id={id} selected={isSelected}
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

                {download &&
                    <Modal title={lf("Preparing your zip file...")} onClose={this.handleDownloadProgressClose}>
                        <ProgressBar percentage={100 * (download.completed / download.max)} />
                    </Modal>}
            </sui.Modal>
        )
    }
}

interface ProjectsCodeRowProps extends pxt.CodeCard {
    scr: any;
    index?: number;
    id?: string;
    selected?: boolean;
    markedNew?: boolean;
    onRowClicked: (e: any, scr: any, index?: number, id?: string, force?: boolean) => void;
}

class ProjectsCodeRow extends sui.StatelessUIElement<ProjectsCodeRowProps> {

    constructor(props: ProjectsCodeRowProps) {
        super(props);

        this.handleClick = this.handleClick.bind(this);
        this.handleCheckboxClick = this.handleCheckboxClick.bind(this);
    }

    handleClick(e: any) {
        this.props.onRowClicked(e, this.props.scr, this.props.index, this.props.id);
    }

    handleCheckboxClick(e: any) {
        this.props.onRowClicked(e, this.props.scr, this.props.index, this.props.id, true);
        e.preventDefault();
        e.stopPropagation();
    }

    renderCore() {
        const { scr, onRowClicked, onClick, selected, markedNew, children, ...rest } = this.props;
        return <tr tabIndex={0} {...rest} onKeyDown={fireClickOnEnter} onClick={this.handleClick} style={{ cursor: 'pointer' }} className={`${markedNew ? 'warning' : selected ? 'positive' : ''}`}>
            <td className="collapsing" onClick={this.handleCheckboxClick}>
                <sui.Icon icon={`circle outline large ${selected ? `check green` : markedNew ? 'black' : ''}`} />
            </td>
            {children}
        </tr>
    }
}
