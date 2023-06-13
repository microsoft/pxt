import * as React from "react";
import { classList, ControlProps } from "../util";

export interface ProgressBarProps extends ControlProps {
    value: number;
    max?: number; // default: 1
    title?: string;
    label?: string;

    ariaValueText?: string;
}

export const ProgressBar = (props: ProgressBarProps) => {
    const {
        value,
        max,
        id,
        className,
        title,
        label,
        role,
        ariaHidden,
        ariaLabel,
        ariaDescribedBy,
        ariaValueText,
    } = props;

    return (
        <div className={classList("common-progressbar-wrapper", className)}>
            {label && <label className="common-progressbar-label">
                {label}
            </label>}
            <progress
                className="common-progressbar"
                value={value}
                aria-valuetext={ariaValueText}
                max={max || 1.0}
                id={id}
                role={role || "progressbar"}
                title={title}
                aria-label={ariaLabel}
                aria-describedby={ariaDescribedBy}
                aria-hidden={ariaHidden}
            />
        </div>
    );
}