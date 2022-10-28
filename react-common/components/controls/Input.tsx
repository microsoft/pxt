import * as React from "react";
import { classList, ControlProps } from "../util";

import { Button } from "./Button";

export interface InputProps extends ControlProps {
    inputClassName?: string;
    groupClassName?: string;
    initialValue?: string;
    label?: string;
    title?: string;
    placeholder?: string;
    icon?: string;
    iconTitle?: string;
    disabled?: boolean;
    type?: string;
    readOnly?: boolean;
    autoComplete?: boolean;
    selectOnClick?: boolean;
    treatSpaceAsEnter?: boolean;
    handleInputRef?: React.RefObject<HTMLInputElement> | ((ref: HTMLInputElement) => void);
    preserveValueOnBlur?: boolean;

    onChange?: (newValue: string) => void;
    onEnterKey?: (value: string) => void;
    onIconClick?: (value: string) => void;
    onBlur?: (value: string) => void;
}

export const Input = (props: InputProps) => {
    const {
        id,
        className,
        inputClassName,
        groupClassName,
        role,
        ariaHidden,
        ariaLabel,
        initialValue,
        label,
        title,
        placeholder,
        icon,
        iconTitle,
        disabled,
        type,
        readOnly,
        autoComplete,
        selectOnClick,
        onChange,
        onEnterKey,
        onIconClick,
        onBlur,
        handleInputRef,
        preserveValueOnBlur
    } = props;

    const [value, setValue] = React.useState(undefined);

    const clickHandler = (evt: React.MouseEvent<any>) => {
        if (selectOnClick) {
            (evt.target as any).select()
        }
    }

    const changeHandler = (e: React.ChangeEvent<any>) => {
        const newValue = (e.target as any).value;
        if (!readOnly && (value !== newValue)) {
            setValue(newValue);
        }
        if (onChange) {
            onChange(newValue);
        }
    }

    const enterKeyHandler = (e: React.KeyboardEvent) => {
        const charCode = (typeof e.which == "number") ? e.which : e.keyCode;
        if (charCode === /*enter*/13 || props.treatSpaceAsEnter && charCode === /*space*/32) {
            if (onEnterKey) {
                e.preventDefault();
                onEnterKey(value);
            }
        }
    }

    const iconClickHandler = () => {
        if (onIconClick) onIconClick(value);
    }

    const blurHandler = () => {
        if (onBlur) {
            onBlur(value);
        }
        if (!preserveValueOnBlur) {
            setValue(undefined);
        }
    }

    return (
        <div className={classList("common-input-wrapper", disabled && "disabled", className)}>
            {label && <label className="common-input-label" htmlFor={id}>
                {label}
            </label>}
            <div className={classList("common-input-group", groupClassName)}>
                <input
                    id={id}
                    className={classList("common-input", icon && "has-icon", inputClassName)}
                    title={title}
                    role={role || "textbox"}
                    tabIndex={disabled ? -1 : 0}
                    aria-label={ariaLabel}
                    aria-hidden={ariaHidden}
                    type={type || "text"}
                    placeholder={placeholder}
                    value={value !== undefined ? value : (initialValue || "")}
                    readOnly={!!readOnly}
                    onClick={clickHandler}
                    onChange={changeHandler}
                    onKeyDown={enterKeyHandler}
                    onBlur={blurHandler}
                    autoComplete={autoComplete ? "" : "off"}
                    autoCorrect={autoComplete ? "" : "off"}
                    autoCapitalize={autoComplete ? "" : "off"}
                    spellCheck={autoComplete}
                    disabled={disabled}
                    ref={handleInputRef} />
                {icon && (onIconClick
                    ? <Button
                        leftIcon={icon}
                        title={iconTitle}
                        disabled={disabled}
                        onClick={iconClickHandler} />
                    : <i
                        className={icon}
                        aria-hidden={true} />)}
            </div>
        </div>
    );
}