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
    maxLength?: number;
    readOnly?: boolean;
    resize?: "both" | "horizontal" | "vertical";
    wrap?: "hard" | "soft" | "off";
    autoResize?: boolean;
    showRemainingCharacterCount?: boolean | number;

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
        maxLength,
        readOnly,
        resize,
        wrap,
        autoResize,
        onChange,
        onEnterKey,
        showRemainingCharacterCount
    } = props;

    const [value, setValue] = React.useState(initialValue || "");
    const textareaRef = React.useRef<HTMLTextAreaElement>(null);
    const previousWidthRef = React.useRef<number>(0);

    const fitVerticalSizeToContent = () => {
        if (!textareaRef.current) {
            return;
        }

        textareaRef.current.style.height = "1px";
        textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }

    React.useEffect(() => {
        setValue(initialValue)

        if (autoResize && textareaRef.current) {
            fitVerticalSizeToContent();
        }
    }, [initialValue])

    React.useEffect(() => {
        if (!autoResize) {
            return () => {};
        }

        const observer = new ResizeObserver((entries) => {
            // If the width has changed, we need to update the vertical height to account for it.
            const width = entries[0].contentRect.width;
            if (previousWidthRef.current != width) {
                requestAnimationFrame(() => fitVerticalSizeToContent());
                previousWidthRef.current = width;
            }
        });

        if (textareaRef.current) {
            observer.observe(textareaRef.current);
        }

        return () => {
            observer.disconnect();
        }
    }, [autoResize]);

    const changeHandler = (e: React.ChangeEvent<any>) => {
        const newValue = (e.target as any).value;
        if (!readOnly && (value !== newValue)) {
            setValue(newValue);
        }
        if (onChange) {
            onChange(newValue);
        }
        if (autoResize && textareaRef.current) {
            fitVerticalSizeToContent();
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

    let shouldShowCharacterCount = maxLength !== undefined && !!showRemainingCharacterCount;

    if (shouldShowCharacterCount && typeof showRemainingCharacterCount === "number") {
        shouldShowCharacterCount = value.length >= (maxLength - showRemainingCharacterCount);
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
                    maxLength={maxLength}
                    wrap={wrap}
                    readOnly={!!readOnly}
                    ref={textareaRef}
                    onChange={changeHandler}
                    onKeyDown={enterKeyHandler}
                    autoComplete={autoComplete ? "" : "off"}
                    autoCorrect={autoComplete ? "" : "off"}
                    autoCapitalize={autoComplete ? "" : "off"}
                    spellCheck={autoComplete}
                    disabled={disabled} />
                    {
                        shouldShowCharacterCount &&
                        <div className="common-textarea-character-count" role="presentation" aria-hidden="true">
                            {maxLength - value.length}
                        </div>
                    }
            </div>
        </div>
    );
}
