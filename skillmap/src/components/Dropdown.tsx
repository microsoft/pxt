import React, { useState } from "react";

import '../styles/dropdown.css'

interface DropdownItem {
    id: string;
    label: string;
    onClick: (id: string) => void;
}

interface DropdownProps {
    icon: string;
    items: DropdownItem[];
    className?: string;
}

export function Dropdown(props: DropdownProps) {
    const { icon, items, className } = props;
    const [ expanded, setExpanded ] = useState(false);

    return <div className={`dropdown ${className} ${expanded ? 'expanded' : ''}`} tabIndex={0}
                onClick={ () => setExpanded(!expanded) }
                onBlur={ () => setExpanded(false) }>
        <i className={`icon ${icon}`} />
        {expanded && <div className="dropdown-menu">
            {items.map((el, i) => {
                return <div key={i} className="dropdown-item" onClick={() => el.onClick(el.id)}>{el.label}</div>
            })}
        </div>}
    </div>
}