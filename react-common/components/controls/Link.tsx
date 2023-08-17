import * as React from "react";
import { classList, ContainerProps } from "../util";

export interface LinkProps extends ContainerProps {
    href: string;
    target?: "_self" | "_blank" | "_parent" | "_top";
    tabIndex?: number;
}

export const Link = (props: LinkProps) => {
    const {
        id,
        className,
        ariaLabel,
        href,
        target,
        children,
        tabIndex
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
            tabIndex={tabIndex ?? 0}
            >
            {children}
        </a>
    );
}