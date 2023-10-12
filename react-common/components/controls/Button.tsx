import * as React from "react";
import { classList, ContainerProps, fireClickOnEnter } from "../util";

export interface ButtonViewProps extends ContainerProps {
    buttonRef?: (ref: HTMLButtonElement) => void;
    title: string;
    label?: string | JSX.Element;
    leftIcon?: string;
    rightIcon?: string;
    disabled?: boolean;     // Disables the button in an accessible-friendly way.
    hardDisabled?: boolean; // Disables the button and prevents clicks. Not recommended. Use `disabled` instead.
    href?: string;
    target?: string;
    tabIndex?: number;
    style?: React.CSSProperties;

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
    onBlur?: () => void;
    onKeydown?: (e: React.KeyboardEvent) => void;
}

export const Button = (props: ButtonProps) => {
    const {
        id,
        className,
        style,
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
        onBlur,
        buttonRef,
        title,
        label,
        leftIcon,
        rightIcon,
        hardDisabled,
        href,
        target,
        tabIndex,
        children
    } = props;

    let {
        disabled
    } = props;

    disabled = disabled || hardDisabled;


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
            style={style}
            title={title}
            ref={buttonRef}
            onClick={!disabled ? clickHandler : undefined}
            onKeyDown={onKeydown || fireClickOnEnter}
            onBlur={onBlur}
            role={role || "button"}
            tabIndex={tabIndex || (disabled ? -1 : 0)}
            disabled={hardDisabled}
            aria-label={ariaLabel}
            aria-hidden={ariaHidden}
            aria-controls={ariaControls}
            aria-expanded={ariaExpanded}
            aria-haspopup={ariaHasPopup as any}
            aria-posinset={ariaPosInSet}
            aria-setsize={ariaSetSize}
            aria-describedby={ariaDescribedBy}
            aria-selected={ariaSelected}>
                {(leftIcon || rightIcon || label) && (
                    <span className="common-button-flex">
                        {leftIcon && <i className={leftIcon} aria-hidden={true}/>}
                        <span className="common-button-label">
                            {label}
                        </span>
                        {rightIcon && <i className={"right " + rightIcon} aria-hidden={true}/>}
                    </span>)}
                {children}
        </button>
    );
}