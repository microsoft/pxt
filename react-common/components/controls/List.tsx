import * as React from "react";
import { classList, ContainerProps } from "../util";

export interface ListProps extends ContainerProps {
}

export const List = (props: ListProps) => {
    const {
        id,
        className,
        ariaHidden,
        ariaLabel,
        role
    } = props;

    return <div
        id={id}
        aria-hidden={ariaHidden}
        aria-label={ariaLabel}
        role={role}
        className={classList("common-list", className)}>
            {React.Children.map(props.children, (child, index) =>
                <div key={index} className="common-list-item">
                    {child}
                </div>
            )}
    </div>
}