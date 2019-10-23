import * as React from "react";

export interface DebuggerTableProps {
    header: string;
    frozen?: boolean;
}

export class DebuggerTable extends React.Component<DebuggerTableProps> {
    render() {
        return <div className="ui varExplorer">
            <div className="ui variableTableHeader">
                {this.props.header}
            </div>
            <div className={`ui segment debugvariables ${this.props.frozen ? "frozen" : ""} ui collapsing basic striped table`}>
                {this.props.children}
            </div>
        </div>
    }
}

export interface DebuggerTableRowProps {
    leftText: string;
    rightText: string;

    refID?: string | number;
    icon?: string;
    rightTitle?: string
    rightClass?: string;
    leftTitle?: string;
    leftClass?: string;
    depth?: number;
    rowClass?: string;

    onClick?: (e: React.SyntheticEvent<HTMLDivElement>, component: DebuggerTableRow) => void;
}

export class DebuggerTableRow extends React.Component<DebuggerTableRowProps> {
    render() {
        return <div role="listitem" className={`item ${this.props.rowClass || ""}`} onClick={this.props.onClick ? this.clickHandler : undefined}>
            <div className="variableAndValue">
                <div className={`variable varname ${this.props.leftClass || ""}`} title={this.props.leftTitle} style={this.props.depth ? { marginLeft: (this.props.depth * 0.75) + "em" } : undefined}>
                    { <i className={`ui icon small ${this.props.icon || "invisible"}`} /> }
                    <span>{this.props.leftText}</span>
                </div>
                <div className="variable detail" style={{ padding: 0.2 }} title={this.props.rightTitle}>
                    <span className={`varval ${this.props.rightClass || ""}`}>{this.props.rightText}</span>
                </div>
            </div>
        </div>
    }

    protected clickHandler = (e: React.SyntheticEvent<HTMLDivElement>) => {
        if (this.props.onClick) this.props.onClick(e, this);
    }
}