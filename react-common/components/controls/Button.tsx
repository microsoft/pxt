import * as React from "react";
import { classList, ControlProps } from "../util";
import { Icon } from "./Icon";

interface ButtonProps extends ControlProps {
    onClick: () => void;
    title: string;
    label?: string;
    leftIcon?: string;
    leftIconClass?: string;
    rightIcon?: string;
    rightIconClass?: string;
    disabled?: string;
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
        leftIconClass,
        rightIcon,
        rightIconClass,
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
            onClick={!disabled && clickHandler}
            role={role || "button"}
            tabIndex={disabled ? 0 : -1}
            aria-label={ariaLabel}
            aria-hidden={ariaHidden}>
                <span className="common-button-flex">
                    {leftIcon && <Icon icon={leftIcon} iconClass={leftIconClass} ariaHidden={true}/>}
                    <span className="common-button-label">
                        {label}
                    </span>
                    {rightIcon && <Icon icon={rightIcon} iconClass={rightIconClass} ariaHidden={true}/>}
                </span>
        </button>
    );
}