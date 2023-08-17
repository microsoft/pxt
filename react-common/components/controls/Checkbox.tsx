import * as React from "react";

import { classList, ControlProps, fireClickOnEnter } from "../util";

interface CheckboxProps extends ControlProps {
    id: string;
    isChecked: boolean;
    onChange: (newValue: boolean) => void;
    label?: string | JSX.Element;
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
        label
    } = props;

    const onCheckboxClick = () => {
        onChange(!isChecked);
    }

    return (
        <div className={classList("common-checkbox", className)}>
            <input
                id={id}
                tabIndex={0}
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