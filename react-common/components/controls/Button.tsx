import * as React from "react";
import { classList, ControlProps, fireClickOnEnter } from "../util";

export interface ButtonViewProps extends ControlProps {
    buttonRef?: (ref: HTMLButtonElement) => void;
    title: string;
    label?: string | JSX.Element;
    leftIcon?: string;
    rightIcon?: string;
    disabled?: boolean;
    href?: string;
    target?: string;
    tabIndex?: number;

    /** Miscellaneous aria pass-through props */
    ariaControls?: string;
    ariaExpanded?: boolean;
    ariaHasPopup?: string;
    ariaPosInSet?: number;
    ariaSetSize?: number;
    ariaSelected?: boolean;
}


export interface ButtonProps extends ButtonViewProps {
    onClick: () => void;
    onKeydown?: (e: React.KeyboardEvent) => void;
}

export const Button = (props: ButtonProps) => {
    const {
        id,
        className,
        ariaLabel,
        ariaHidden,
        ariaDescribedBy,
        ariaControls,
        ariaExpanded,
        ariaHasPopup,
        ariaPosInSet,
        ariaSetSize,
        ariaSelected,
        role,
        onClick,
        onKeydown,
        buttonRef,
        title,
        label,
        leftIcon,
        rightIcon,
        disabled,
        href,
        target,
        tabIndex
    } = props;

    const classes = classList(
        "common-button",
        className,
        disabled && "disabled"
    );

    let clickHandler = (ev: React.MouseEvent) => {
        if (onClick) onClick();
        if (href) window.open(href, target || "_blank", "noopener,noreferrer")
        ev.stopPropagation();
        ev.preventDefault();
    }

    return (
        <button
            id={id}
            className={classes}
            title={title}
            ref={buttonRef}
            onClick={!disabled ? clickHandler : undefined}
            onKeyDown={onKeydown || fireClickOnEnter}
            role={role || "button"}
            tabIndex={tabIndex || (disabled ? -1 : 0)}
            aria-label={ariaLabel}
            aria-hidden={ariaHidden}
            aria-controls={ariaControls}
            aria-expanded={ariaExpanded}
            aria-haspopup={ariaHasPopup as any}
            aria-posinset={ariaPosInSet}
            aria-setsize={ariaSetSize}
            aria-describedby={ariaDescribedBy}
            aria-selected={ariaSelected}>
                <span className="common-button-flex">
                    {leftIcon && <i className={leftIcon} aria-hidden={true}/>}
                    <span className="common-button-label">
                        {label}
                    </span>
                    {rightIcon && <i className={"right " + rightIcon} aria-hidden={true}/>}
                </span>
        </button>
    );
}