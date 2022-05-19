import * as React from "react";
import { classList, ContainerProps } from "../util";

export interface CardProps extends ContainerProps {
    onClick?: () => void;
}

export const Card = (props: CardProps) => {
    const {
        id,
        className,
        role,
        children,
        ariaDescribedBy,
        ariaHidden,
        ariaLabel,
        onClick
    } = props;

    return <div
        id={id}
        className={classList("common-card", className)}
        role={role || (onClick ? "button" : undefined)}
        aria-describedby={ariaDescribedBy}
        aria-hidden={ariaHidden}
        aria-label={ariaLabel}
        onClick={onClick}>
            <div className="common-card-body">
                {children}
            </div>
    </div>
}