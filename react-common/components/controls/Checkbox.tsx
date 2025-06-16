import * as React from "react";

import { classList, ControlProps, fireClickOnEnter } from "../util";

interface CheckboxProps extends ControlProps {
    id: string;
    isChecked: boolean;
    onChange: (newValue: boolean) => void;
    label?: string | JSX.Element;
    style?: "toggle" | "default"
    tabIndex?: number;
}

export const Checkbox = (props: CheckboxProps) => {
    const {
        id,
        className,
        ariaHidden,
        ariaLabel,
        role,
        isChecked,
        onChange,
        label,
        style,
        tabIndex
    } = props;

    const onCheckboxClick = () => {
        onChange(!isChecked);
    }

    return (
        <div className={classList("common-checkbox", className, style === "toggle" && "toggle")}>
            <input
                id={id}
                tabIndex={tabIndex ?? 0}
                type="checkbox"
                checked={isChecked}
                onChange={onCheckboxClick}
                onKeyDown={fireClickOnEnter}
                role={role}
                aria-hidden={ariaHidden}
                aria-label={ariaLabel}
            />
            {label && <label htmlFor={id}>
                {label}
            </label>
            }
        </div>
    )
}

interface CheckboxIconProps {
    isChecked: boolean;
}

export const CheckboxIcon = (props: CheckboxIconProps) => {
    const { isChecked } = props;

    return (
        <span className={classList("common-checkbox-icon", isChecked && "checked")}>
            {isChecked && <i className="fas fa-check" />}
        </span>
    );
}