import * as React from "react";
import { classList, ControlProps } from "../util";

export interface TextareaProps extends ControlProps {
    initialValue?: string;
    label?: string;
    title?: string;
    placeholder?: string;
    autoComplete?: boolean;
    cols?: number;
    rows?: number;
    disabled?: boolean;
    minLength?: number;
    readOnly?: boolean;
    resize?: "both" | "horizontal" | "vertical";
    wrap?: "hard" | "soft" | "off";
    autoResize?: boolean;
    resizeRef?: React.RefObject<HTMLTextAreaElement>;

    onChange?: (newValue: string) => void;
    onEnterKey?: (value: string) => void;
}

export const Textarea = (props: TextareaProps) => {
    const {
        id,
        className,
        role,
        ariaHidden,
        ariaLabel,
        initialValue,
        label,
        title,
        placeholder,
        autoComplete,
        cols,
        rows,
        disabled,
        minLength,
        readOnly,
        resize,
        wrap,
        autoResize,
        resizeRef,
        onChange,
        onEnterKey
    } = props;

    const [value, setValue] = React.useState(initialValue || "");

    React.useEffect(() => {
        setValue(initialValue)
    }, [initialValue])


    const changeHandler = (e: React.ChangeEvent<any>) => {
        const newValue = (e.target as any).value;
        if (!readOnly && (value !== newValue)) {
            setValue(newValue);
        }
        if (onChange) {
            onChange(newValue);
        }
        if (autoResize && resizeRef.current) {
            resizeRef.current.style.height = "1px";
            resizeRef.current.style.height = `${25 + resizeRef.current.scrollHeight}px`;
        }
    }

    const enterKeyHandler = (e: React.KeyboardEvent) => {
        const charCode = (typeof e.which == "number") ? e.which : e.keyCode;
        if (charCode === /*enter*/ 13 || charCode === /*space*/ 32) {
            if (onEnterKey) {
                e.preventDefault();
                onEnterKey(value);
            }
        }
    }

    return (
        <div className={classList("common-textarea-wrapper", disabled && "disabled", resize && `resize-${resize}`, className)}>
            {label && <label className="common-textarea-label">
                {label}
            </label>}
            <div className="common-textarea-group">
                <textarea
                    id={id}
                    className={"common-textarea"}
                    title={title}
                    role={role || "textbox"}
                    tabIndex={disabled ? -1 : 0}
                    aria-label={ariaLabel}
                    aria-hidden={ariaHidden}
                    placeholder={placeholder}
                    value={value || ''}
                    cols={cols}
                    rows={rows}
                    minLength={minLength}
                    wrap={wrap}
                    readOnly={!!readOnly}
                    ref={resizeRef}
                    onChange={changeHandler}
                    onKeyDown={enterKeyHandler}
                    autoComplete={autoComplete ? "" : "off"}
                    autoCorrect={autoComplete ? "" : "off"}
                    autoCapitalize={autoComplete ? "" : "off"}
                    spellCheck={autoComplete}
                    disabled={disabled} />
            </div>
        </div>
    );
}