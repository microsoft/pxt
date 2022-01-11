import * as React from "react";
import { classList, ControlProps, fireClickOnEnter } from "../util";

interface ButtonProps extends ControlProps {
    onClick: () => void;
    title: string;
    label?: string;
    leftIcon?: string;
    rightIcon?: string;
    disabled?: boolean;
    href?: string;
    target?: string;
}

export const Button = (props: ButtonProps) => {
    const {
        id,
        className,
        ariaLabel,
        ariaHidden,
        role,
        onClick,
        title,
        label,
        leftIcon,
        rightIcon,
        disabled,
        href,
        target
    } = props;

    const classes = classList(
        "common-button",
        className,
        disabled && "disabled"
    );

    let clickHandler = () => {
        if (onClick) onClick();
        if (href) window.open(href, target || "_blank", "noopener,noreferrer")
    }

    return (
        <button
            id={id}
            className={classes}
            title={title}
            onClick={!disabled ? clickHandler : undefined}
            onKeyDown={fireClickOnEnter}
            role={role || "button"}
            tabIndex={disabled ? -1 : 0}
            aria-label={ariaLabel}
            aria-hidden={ariaHidden}>
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