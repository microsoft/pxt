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
            view: 'grid'
        }

        this.close = this.close.bind(this);
        this.handleCardClick = this.handleCardClick.bind(this);
        this.handleCheckboxClick = this.handleCheckboxClick.bind(this);
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
        const ctrlCmd = force || e.metaKey;
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
    }

    handleCheckboxClick() {
        let { selected } = this.state;

        this.setState({ selected });
    }

    handleDelete() {
        let { selected } = this.state;
        const headers = this.fetchLocalData();
        headers.forEach((header, index) => {
            if (selected[index]) {
                // Delete each selected project
                header.isDeleted = true;
                workspace.saveAsync(header, {});
            }
        })
        this.setState({ selected: {} })
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
        // TODO: implementing duplicating project without opening a project
    }

    handleSwitchView() {
        const newView = this.state.view == 'grid' ? 'list' : 'grid';
        this.setState({ view: newView });
    }

    handleSearch(inputValue: string) {
        this.setState({ searchFor: inputValue });
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
        const { visible, selected, view, searchFor } = this.state;
        if (!visible) return <div></div>;

        let headers = this.fetchLocalData() || [];
        headers = headers.filter(h => !h.isDeleted);
        const isSearching = false;

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
                headerActions.push(<sui.Button key="edit" icon="edit outline" className="circular icon" title={lf("Edit Project")} onClick={this.handleOpen} />);
                //headerActions.push(<sui.Button key="rename" icon="font" className="circular icon" title={lf("Rename Project")} onClick={this.handleRename} />);
                headerActions.push(<sui.Button key="clone" icon="clone outline" className="circular icon" title={lf("Clone Project")} onClick={this.handleDuplicate} />);
                headerActions.push(<sui.Button key="export" icon="download" className="circular icon" title={lf("Save Project")} onClick={this.handleExport} />);
            }
            headerActions.push(<sui.Button key="delete" icon="trash" className="circular icon" title={lf("Delete Project")} onClick={this.handleDelete} />);
            headerActions.push(<div key="divider" className="divider"></div>);
        }
        headerActions.push(<sui.Button key="view" icon={view == 'grid' ? 'th list' : 'grid layout'} className="circular icon" title={`${view == 'grid' ? lf("List view") : lf("Grid view")}`} onClick={this.handleSwitchView} />)

        /* tslint:disable:react-a11y-anchors */
        return (
            <sui.Modal isOpen={visible} className="scriptmanagerdialog" size="fullscreen"
                onClose={this.close} dimmer={true} header={lf("My Projects")}
                closeIcon={true} headerActions={headerActions}
                closeOnDimmerClick closeOnDocumentClick closeOnEscape
            >
                {view == 'grid' ?
                    <div className={"ui cards"}>
                        {headers.map((scr, index) =>
                            <ProjectsCodeCard
                                key={'local' + scr.id + scr.recentUse}
                                cardType="file"
                                className={scr.githubId ? "file github" : "file"}
                                name={scr.name}
                                time={scr.recentUse}
                                url={scr.pubId && scr.pubCurrent ? "/" + scr.pubId : ""}
                                scr={scr} index={index}
                                label={selected[index] ? 'Selected' : undefined}
                                onCardClick={this.handleCardClick}
                            />
                        )}
                    </div> : undefined}
                {view == 'list' ?
                    <table className="ui compact definition unstackable table">
                        <thead className="full-width">
                            <tr>
                                <th></th>
                                <th>Name</th>
                                <th>Updated</th>
                            </tr>
                        </thead>
                        <tbody>
                            {headers.map((scr, index) =>
                                <ProjectsCodeRow key={'local' + scr.id + scr.recentUse} selected={!!selected[index]}
                                    onRowClicked={this.handleCardClick} index={index} scr={scr}>
                                    <td>{scr.name}</td>
                                    <td>{pxt.Util.timeSince(scr.recentUse)}</td>
                                </ProjectsCodeRow>
                            )}
                        </tbody>
                    </table>
                    : undefined}
            </sui.Modal>
        )
    }
}


interface ProjectsCodeRowProps extends pxt.CodeCard {
    scr: any;
    index?: number;
    selected?: boolean;
    onRowClicked: (e: any, scr: any, index?: number, force?: boolean) => void;
}

class ProjectsCodeRow extends sui.StatelessUIElement<ProjectsCodeRowProps> {

    constructor(props: ProjectsCodeRowProps) {
        super(props);

        this.handleClick = this.handleClick.bind(this);
        this.handleCheckboxClick = this.handleCheckboxClick.bind(this);
        this.handleCheckboxChange = this.handleCheckboxChange.bind(this);
    }

    handleClick(e: any) {
        this.props.onRowClicked(e, this.props.scr, this.props.index);
    }

    handleCheckboxClick(e: any) {
        this.props.onRowClicked(e, this.props.scr, this.props.index, true);
        e.preventDefault();
        e.stopPropagation();
    }

    handleCheckboxChange(e: any) {

    }

    renderCore() {
        const { scr, onRowClicked, onClick, selected, children, ...rest } = this.props;
        return <tr {...rest} onClick={this.handleClick} style={{ cursor: 'pointer' }} className={`${selected ? 'active' : ''}`}>
            <td className="collapsing" onClick={this.handleCheckboxClick}>
                <PlainCheckbox onChange={this.handleCheckboxChange} defaultChecked={selected}/>
            </td>
            {children}
        </tr>
    }
}


interface PlainCheckboxProps {
    label?: string;
    onChange: (v: boolean) => void;
    defaultChecked?: boolean;
}

interface PlainCheckboxState {
    isChecked: boolean;
}

class PlainCheckbox extends data.Component<PlainCheckboxProps, PlainCheckboxState> {
    constructor(props: PlainCheckboxProps) {
        super(props);
        this.state = {
            isChecked: props.defaultChecked
        }
        this.setCheckedBit = this.setCheckedBit.bind(this);
    }

    setCheckedBit() {
        let val = !this.state.isChecked
        this.props.onChange(val)
        this.setState({ isChecked: val })
    }

    renderCore() {
        return <div className={`ui fitted ${this.state.isChecked ? 'checked' : ''} checkbox`}>
            <input type="checkbox" onChange={this.setCheckedBit} checked={this.state.isChecked} aria-checked={this.state.isChecked} /> <label>{this.props.label}</label>
        </div>
    }
}