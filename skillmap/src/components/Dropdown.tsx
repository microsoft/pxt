import * as React from "react";

/* eslint-disable import/no-unassigned-import, import/no-internal-modules */
import '../styles/dropdown.css'
/* eslint-enable import/no-unassigned-import, import/no-internal-modules */

export interface DropdownItem {
    id: string;
    label: string;
    onClick: (id: string) => void;
}

interface DropdownProps {
    icon: string;
    picture?: JSX.Element;
    items: DropdownItem[];
    className?: string;
}

interface DropdownState {
    expanded: boolean;
}

export class Dropdown extends React.Component<DropdownProps, DropdownState> {
    constructor(props: DropdownProps) {
        super(props);

        this.state = { expanded: false };
    }

    protected handleOnClick = () => {
        this.setState({ expanded: !this.state.expanded })
    }

    protected handleOnBlur = () => {
        this.setState({ expanded: false })
    }

    protected getItemOnClick(item: DropdownItem): () => void {
        return () => item.onClick(item.id);
    }

    render() {
        const { icon, picture, items, className } = this.props;
        const { expanded } = this.state;

        return <div className={`dropdown ${className} ${expanded ? 'expanded' : ''}`} tabIndex={0} role="button"
                    onClick={this.handleOnClick}
                    onBlur={this.handleOnBlur}>
            {picture ? picture : <i className={icon} />}
            {expanded && <div className="dropdown-menu">
                {items.map((el, i) => {
                    return <div key={i} className="dropdown-item" onClick={this.getItemOnClick(el)} role="menuitem">{el.label}</div>
                })}
            </div>}
        </div>
    }
}