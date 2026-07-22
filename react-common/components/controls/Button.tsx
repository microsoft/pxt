import * as React from "react";
import { classList, ContainerProps, fireClickOnEnter } from "../util";

export interface ButtonViewProps extends ContainerProps {
    title: string;
    label?: string | JSX.Element;
    labelClassName?: string;
    leftIcon?: string;
    rightIcon?: string;
    autoFocus?: boolean;
    disabled?: boolean;     // Disables the button in an accessible-friendly way.
    hardDisabled?: boolean; // Disables the button and prevents clicks. Not recommended. Use `disabled` instead.
    tabIndex?: number;
    style?: React.CSSProperties;

    /** Miscellaneous aria pass-through props */
    ariaControls?: string;
    ariaExpanded?: boolean;
    ariaHasPopup?: string;
    ariaPosInSet?: number;
    ariaSetSize?: number;
    ariaSelected?: boolean;
    ariaPressed?: boolean | "mixed";
}


export interface ButtonProps extends ButtonViewProps {
    buttonRef?: (ref: HTMLElement) => void;
    href?: string;
    target?: string;
    onClick: () => void;
    onClickEvent?: (e: React.MouseEvent) => void;
    onRightClick?: () => void;
    onBlur?: () => void;
    onFocus?: () => void;
    onKeydown?: (e: React.KeyboardEvent) => void;
    onMouseDown?: (e: React.MouseEvent) => void;
}

export const Button = (props: ButtonProps) => {
    const inflated = inflateButtonProps(props);

    return (
        <button {...inflated}>
            <ButtonBody {...props} />
        </button>
    );
}

export const ButtonBody = (props: ButtonViewProps) => {
    const {
        label,
        labelClassName,
        leftIcon,
        rightIcon,
        children
    } = props;

    return (
        <>
            {(leftIcon || rightIcon || label) && (
                <span className="common-button-flex">
                    {leftIcon && <i className={leftIcon} aria-hidden={true}/>}
                    <span className={classList("common-button-label", labelClassName)}>
                        {label}
                    </span>
                    {rightIcon && <i className={"right " + rightIcon} aria-hidden={true}/>}
                </span>)}
            {children}
        </>
    )
}

export function inflateButtonProps(props: ButtonProps) {
    const {
        onClick,
        onClickEvent,
        onRightClick,
        onKeydown,
        onBlur,
        onFocus,
        onMouseDown,
        buttonRef,
        target,
        href,
        hardDisabled
    } = props;

    let {
        disabled
    } = props;

    disabled = disabled || hardDisabled;

    const clickHandler = (ev: React.MouseEvent) => {
        if (onClickEvent) onClickEvent(ev);
        if (onClick) onClick();
        if (href) window.open(href, target || "_blank", "noopener,noreferrer")
        ev.stopPropagation();
        ev.preventDefault();
    }

    const rightClickHandler = (ev: React.MouseEvent) => {
        if (onRightClick) {
            onRightClick();
            ev.stopPropagation();
            ev.preventDefault();
        }
    }

    return {
        ...inflateButtonViewProps(props),
        "ref": buttonRef,
        "onClick": !disabled ? clickHandler : undefined,
        "onContextMenu": rightClickHandler,
        "onKeyDown": onKeydown || fireClickOnEnter,
        "onBlur": onBlur,
        "onFocus": onFocus,
        "onMouseDown": onMouseDown,
    };
}

export function inflateButtonViewProps(props: ButtonViewProps) {
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
        ariaPressed,
        role,
        title,
        hardDisabled,
        tabIndex,
        autoFocus,
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

    return {
        "id": id,
        "className": classes,
        "style": style,
        "title": title,
        "role": role || "button",
        "tabIndex": tabIndex || (disabled ? -1 : 0),
        "autoFocus": autoFocus,
        "disabled": hardDisabled,
        "aria-label": ariaLabel,
        "aria-hidden": ariaHidden,
        "aria-controls": ariaControls,
        "aria-expanded": ariaExpanded,
        "aria-haspopup": ariaHasPopup as any,
        "aria-posinset": ariaPosInSet,
        "aria-setsize": ariaSetSize,
        "aria-describedby": ariaDescribedBy,
        "aria-selected": ariaSelected,
        "aria-pressed": ariaPressed,
    };
}