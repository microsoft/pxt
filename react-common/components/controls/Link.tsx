import * as React from "react";
import { classList, ContainerProps } from "../util";

export interface LinkProps extends ContainerProps {
    href: string;
    target?: "_self" | "_blank" | "_parent" | "_top";
}

export const Link = (props: LinkProps) => {
    const {
        id,
        className,
        ariaLabel,
        href,
        target,
        children
    } = props;

    const classes = classList(
        "common-link",
        className
    );

    return (
        <a
            id={id}
            className={classes}
            aria-label={ariaLabel}
            href={href}
            target={target}
            rel={target === "_blank" ? "noopener noreferrer" : ""}
            >
            {children}
        </a>
    );
}