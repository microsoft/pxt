import * as React from "react";
import { classList, ContainerProps, fireClickOnEnter } from "../util";

export interface CardProps extends ContainerProps {
    onClick?: () => void;
    tabIndex?: number;
    ariaLabelledBy?: string;
    ariaPressed?: boolean;
    label?: React.ReactNode;
    labelClass?: string;
}

export const Card = (props: CardProps) => {
    const {
        id,
        className,
        role,
        children,
        ariaDescribedBy,
        ariaLabelledBy,
        ariaPressed,
        ariaHidden,
        ariaLabel,
        onClick,
        label,
        labelClass,
        tabIndex
    } = props;

    return <div
        id={id}
        className={classList("common-card", className)}
        role={role}
        aria-hidden={ariaHidden}
        aria-label={ariaLabel}>
            <div className="common-card-body">
                {onClick &&
                    <button
                        className="common-card-action"
                        tabIndex={tabIndex}
                        aria-describedby={ariaDescribedBy}
                        aria-labelledby={ariaLabelledBy}
                        aria-pressed={ariaPressed}
                        onClick={onClick}
                    />
                }
                {children}
            </div>
            {label &&
                <label className={classList("common-card-label", labelClass)}>
                    {label}
                </label>
            }
    </div>
}