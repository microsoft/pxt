import * as React from "react";
import { fireClickOnEnter } from "../util";

interface FilterTagProps {
    tag: string;
    selected: boolean;
    onClickHandler: (selected: string) => void;
}

export class FilterTag extends React.Component<FilterTagProps> {
    constructor(props: FilterTagProps) {
        super(props)
        this.clickHandler = this.clickHandler.bind(this);
    }

    render() {
        return <div className="filter-tag">
            <div className="filter-tag-box" role="checkbox" onClick={this.clickHandler} onKeyDown={fireClickOnEnter} aria-checked={this.props.selected}>
                <i className={`icon square outline ${this.props.selected ? "check" : ""}`}></i>
            </div>
            <div className="filter-tag-name" role="button" onClick={this.clickHandler} onKeyDown={fireClickOnEnter}>{pxtc.U.rlf(this.props.tag)}</div>
        </div>
    }

    protected clickHandler() {
        this.props.onClickHandler(this.props.tag);
    }
}


interface FilterPanelSubheadingProps {
    subheading: string;
    buttonText?: string;
    buttonAction?: () => void;
    buttonStyle?: React.CSSProperties;
}

export class FilterPanelSubheading extends React.Component<FilterPanelSubheadingProps> {

    render() {
        return <div className="filter-subheading-row">
            <div className="filter-subheading-title">{`${this.props.subheading}:`}</div>
            {this.props.buttonText && <div className="filter-subheading-button" role="button" style={this.props.buttonStyle} onClick={this.props.buttonAction} onKeyDown={fireClickOnEnter}>{this.props.buttonText}</div>}
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
        return this.props.enabledTags.indexOf(tag.toLowerCase()) >= 0;
    }

    render() {
        const tags = this.props.tagOptions;
        return <div className="filter-panel">
            <div className="filter-title">{lf("Filter")}</div>
            <FilterPanelSubheading subheading={lf("Categories")} buttonText={lf("Clear")} buttonAction={this.props.clearTags} buttonStyle={this.props.enabledTags.length > 0 ? {'color': 'white'} : {}}/>
            <div className="filter-tag-list">
                {tags.map(tag => <FilterTag key={tag} tag={tag} selected={this.isTagSelected(tag)} onClickHandler={this.props.tagClickHandler}/>)}
            </div>
        </div>
    }
}