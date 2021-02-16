import * as React from "react";

interface FilterTagProps {
    tag: string;
    selected: boolean;
    onClick: (selected: string) => void;
}

export class FilterTag extends React.Component<FilterTagProps> {

    render() {
        return <div className="filter-tag">
            <div className="filter-tag-box" role="button" onClick={()=>{this.props.onClick(this.props.tag)}}>
                <i className={this.props.selected ? `icon check square outline` : `icon square outline`}></i>
            </div>
            <div className="filter-tag-name" onClick={()=>{this.props.onClick(this.props.tag)}}>{lf(this.props.tag)}</div>
        </div>
    }
}


interface FilterPanelSubheadingProps {
    subheading: string;
    buttonText?: string;
    buttonAction?: () => void;
}

export class FilterPanelSubheading extends React.Component<FilterPanelSubheadingProps> {

    render() {
        return <div className="filter-subheading-row">
            <div className="filter-subheading-title">{`${lf(this.props.subheading)}:`}</div>
            {this.props.buttonText && <div className="filter-subheading-button" role="button" onClick={this.props.buttonAction}>{lf(this.props.buttonText)}</div>}
        </div>
    }
}

interface FilterPanelProps {
    enabledTags: string[];
    tagClickHandler: (tag: string) => void;
    clearTags: () => void;
    tagOptions: string[];
}

export class FilterPanel extends React.Component<FilterPanelProps> {
    protected isTagSelected(tag: string) {
        return this.props.enabledTags.indexOf(tag.toLowerCase()) < 0 ? false : true;
    }

    render() {
        const tags = this.props.tagOptions;
        return <div className="filter-panel">
            <div className="filter-title">{lf("Filter")}</div>
            <FilterPanelSubheading subheading={"Categories"} buttonText="Clear" buttonAction={this.props.clearTags}/>
            <div className="filter-tag-list">
                {tags.map(tag => <FilterTag key={tag} tag={tag} selected={this.isTagSelected(tag)} onClick={this.props.tagClickHandler}/>)}
            </div>
        </div>
    }
}