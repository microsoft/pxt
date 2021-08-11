import * as React from "react";

export interface ButtonProps {
    className?: string;
    id?: string;
    role?: string;
    title?: string;
    tabIndex?: number;
    ariaLabel?: string;
    ariaExpanded?: boolean;

    icon?: string;
    text?: string;
    textFirst?: boolean;
    disabled?: boolean;

    onClick?: (evt: React.MouseEvent) => void;
    onKeyDown?: (evt: React.KeyboardEvent) => void;
}

export function Button(props: ButtonProps) {
    const { className, id, role, title, tabIndex, ariaLabel, ariaExpanded,
        icon, text, textFirst, disabled, onClick, onKeyDown } = props;
    return <div className={`core-button ${className || ""} ${textFirst ? "text-first" : "" } ${disabled ? "disabled" : "" }`}
        id={id}
        role={role}
        title={title}
        tabIndex={tabIndex || 0}
        aria-label={ariaLabel}
        aria-expanded={ariaExpanded}
        onClick={onClick}
        onKeyDown={onKeyDown} >
            {icon && <i className={`ui icon ${icon}`} />}
            {text}
    </div>
}