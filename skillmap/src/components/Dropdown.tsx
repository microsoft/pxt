import * as React from "react";

import '../styles/dropdown.css'

export interface DropdownItem {
    id: string;
    label: string;
    onClick: (id: string) => void;
}

interface DropdownProps {
    icon: string;
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

    render() {
        const { icon, items, className } = this.props;
        const { expanded } = this.state;

        return <div className={`dropdown ${className} ${expanded ? 'expanded' : ''}`} tabIndex={0}
                    onClick={ () => this.handleOnClick }
                    onBlur={ () => this.handleOnBlur }>
            <i className={`icon ${icon}`} />
            {expanded && <div className="dropdown-menu">
                {items.map((el, i) => {
                    return <div key={i} className="dropdown-item" onClick={() => el.onClick(el.id)}>{el.label}</div>
                })}
            </div>}
        </div>
    }
}