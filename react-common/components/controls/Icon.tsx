import * as React from "react";
import { classList, ControlProps } from "../util";

interface IconProps extends ControlProps {
    icon: string;
    iconClass?: string;
}

export const Icon = (props: IconProps) => {
    const {
        id,
        className,
        ariaLabel,
        ariaHidden,
        role,
        icon,
        iconClass,
    } = props;

    const classes = classList(
        "common-icon",
        iconClass,
        icon,
        className,
    );

    return (
        <i id={id}
            className={classes}
            role={role}
            aria-label={ariaLabel}
            aria-hidden={ariaHidden}
        />
    );
}