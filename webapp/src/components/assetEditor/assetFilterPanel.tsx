import * as React from "react";
import { connect } from 'react-redux';

import { AssetEditorState } from "./store/assetEditorReducer";
import { dispatchFilterTagToggle } from './actions/dispatch';

interface AssetFilterTagProps {
    tag: string;
    selected: boolean;
    onClick: (selected: string) => void;
}

export class AssetFilterTag extends React.Component<AssetFilterTagProps> {
    private onClickHandler() {
        console.log("VVN: click")
        this.props.onClick(this.props.tag)
    }

    render() {
        return <div className="asset-editor-filter-tag">
            <div className="asset-editor-filter-tag-box" role="button" onClick={this.onClickHandler}>
                <i className={this.props.selected ? `icon check square outline` : `icon square outline`}></i>
            </div>
            <div className="asset-editor-filter-tag-name" onClick={this.onClickHandler}>{lf(this.props.tag)}</div>
        </div>
    }
}

interface AssetFilterPanelProps {
    enabledTags: string[];
    dispatchFilterTagToggle?: (tag: string) => void;
}


export class AssetFilterPanelImpl extends React.Component<AssetFilterPanelProps> {
    protected getAvailableTags() {
        return ["People", "Animals", "Food"];
    }

    protected clickedTag(tag: string) {
        console.log("VVN: clicked " + tag);
        dispatchFilterTagToggle(tag);
    }

    protected isTagSelected(tag: string) {
        return this.props.enabledTags.indexOf(tag) < 0 ? false : true;
    }

    render() {
        const tags = this.getAvailableTags();
        return <div>
            <div className="asset-editor-filter-title">{lf("Sort And Filter")}</div>
            <div className="asset-editor-filter-tag-list">
                {tags.map(tag => <AssetFilterTag tag={tag} selected={this.isTagSelected(tag)} onClick={this.clickedTag}/>)}
            </div>
        </div>
    }
}

function mapStateToProps(state: AssetEditorState, ownProps: any) {
    if (!state) return {};
    return {
        enabledTags: state.selectedTags
    }
}

const mapDispatchToPros = {
    dispatchFilterTagToggle
}

export const AssetFilterPanel = connect(mapStateToProps, mapDispatchToProps)(AssetFilterPanelImpl)