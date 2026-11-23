import * as React from "react";
import { classList, ControlProps } from "../util";

import { Button } from "./Button";
import { FocusList } from "./FocusList";

export interface InputProps extends ControlProps {
    inputClassName?: string;
    groupClassName?: string;
    initialValue?: string;
    label?: string | JSX.Element;
    title?: string;
    placeholder?: string;
    icon?: string;
    iconTitle?: string;
    disabled?: boolean;
    type?: string;
    readOnly?: boolean;
    autoFocus?: boolean;
    autoComplete?: boolean;
    selectOnClick?: boolean;
    treatSpaceAsEnter?: boolean;
    handleInputRef?: React.RefObject<HTMLInputElement> | ((ref: HTMLInputElement) => void);
    preserveValueOnBlur?: boolean;
    options?: pxt.Map<string>;
    filter?: string;
    maxLength?: number;

    validator?: (value: string, prevValue: string) => string;
    onChange?: (newValue: string) => void;
    onEnterKey?: (value: string) => void;
    onIconClick?: (value: string) => void;
    onFocus?: (value: string) => void;
    onBlur?: (value: string) => void;
    onOptionSelected?: (value: string) => void;
}

const sanitizeForDomId = (text: string | undefined) => {
    if (!text) {
        return "";
    }

    const sanitized = text.replace(/[^a-zA-Z0-9_-]/g, "-");
    return sanitized || "option";
};

const truncateToCodePointBoundary = (str: string, maxLen: number): string => {
    if (str.length <= maxLen) return str;
    let truncated = str.slice(0, maxLen);
    const lastCharCode = truncated.charCodeAt(truncated.length - 1);
    if (lastCharCode >= 0xD800 && lastCharCode <= 0xDBFF) {
        truncated = truncated.slice(0, -1);
    }
    return truncated;
};

const getSelection = (input: HTMLInputElement): { start: number; end: number } | null => {
    try {
        if (input.selectionStart !== null && input.selectionEnd !== null) {
            return { start: input.selectionStart, end: input.selectionEnd };
        }
    } catch {}
    return null;
};

const setCaret = (input: HTMLInputElement, pos: number) => {
    try {
        input.setSelectionRange?.(pos, pos);
    } catch {}
};

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
        autoFocus,
        autoComplete,
        selectOnClick,
        onChange,
        onEnterKey,
        onIconClick,
        onFocus,
        onBlur,
        onOptionSelected,
        handleInputRef,
        preserveValueOnBlur = true,
        options,
        validator,
        maxLength,
    } = props;

    const [value, setValue] = React.useState(initialValue || "");
    const [expanded, setExpanded] = React.useState(false);
    const filter = React.useMemo(() => (props.filter ? new RegExp(props.filter, "g") : undefined), [props.filter]);
    const optionValues = React.useMemo(() => (options ? Object.values(options) : []), [options]);
    const isComposingRef = React.useRef(false);
    const lastCommittedValueRef = React.useRef(initialValue || "");

    let container: HTMLDivElement;

    React.useEffect(() => {
        setValue(initialValue || "");
        lastCommittedValueRef.current = initialValue || "";
    }, [initialValue]);

    const handleContainerRef = (ref: HTMLDivElement) => {
        if (!ref) return;
        container = ref;
    }

    const clickHandler = (evt: React.MouseEvent<any>) => {
        if (selectOnClick) {
            (evt.target as any).select()
        }

        if (options && !expanded) {
            setExpanded(true);
        }
    }

    const sanitizeValue = (val: string) => {
        let res = val;
        if (res && filter) {
            filter.lastIndex = 0;
            res = res.match(filter)?.join("") || "";
        }
        if (maxLength !== undefined && res.length > maxLength) {
            res = truncateToCodePointBoundary(res, maxLength);
        }
        return res;
    };

    const applyValue = (newValue: string) => {
        if (!readOnly && (value !== newValue)) {
            setValue(newValue);
        }
        if (lastCommittedValueRef.current !== newValue) {
            lastCommittedValueRef.current = newValue;
            if (onChange) {
                onChange(newValue);
            }
        }
    };

    const processInput = (input: HTMLInputElement) => {
        const rawValue = input.value;
        const selection = getSelection(input);
        const caret = selection ? selection.start : rawValue.length;
        let newCaretPos = caret;
        if (filter) {
            filter.lastIndex = 0;
            const rawBeforeCaret = rawValue.slice(0, caret);
            const cleanBeforeCaret = rawBeforeCaret.match(filter)?.join("") || "";
            newCaretPos = cleanBeforeCaret.length;
        }

        const sanitized = sanitizeValue(rawValue);
        if (input.value !== sanitized) {
            input.value = sanitized;
            if (selection) {
                const boundedCaret = Math.min(newCaretPos, sanitized.length);
                setCaret(input, boundedCaret);
            }
        }
        applyValue(sanitized);
    };

    const isConstrained = Boolean(filter || maxLength !== undefined);

    const changeHandler = (e: React.ChangeEvent<any>) => {
        const input = e.target as HTMLInputElement;
        if (isComposingRef.current && isConstrained) {
            setValue(input.value);
            return;
        }
        processInput(input);
    };

    const pasteHandler = (e: React.ClipboardEvent<HTMLInputElement>) => {
        if (!filter || readOnly || disabled) return;
        const text = e.clipboardData?.getData("text");
        if (!text) return;

        const input = e.currentTarget;
        const selection = getSelection(input);
        // Leave paste to the browser when selection offsets are unavailable (e.g. number/email inputs)
        if (!selection) return;

        const textWithoutBreaks = text.replace(/[\r\n]+/g, "");
        filter.lastIndex = 0;
        const cleanPaste = textWithoutBreaks.match(filter)?.join("") || "";
        const prefix = value.slice(0, selection.start);
        const suffix = value.slice(selection.end);

        const remainingCapacity = maxLength !== undefined
            ? Math.max(0, maxLength - prefix.length - suffix.length)
            : cleanPaste.length;

        // If the pasted text is already valid and fits without truncation, let native paste handle it
        // so that browser undo/redo history (Ctrl+Z) is preserved.
        if (cleanPaste === text && text.length <= remainingCapacity) {
            return;
        }

        e.preventDefault();
        const truncatedInsert = truncateToCodePointBoundary(cleanPaste, remainingCapacity);
        const newValue = prefix + truncatedInsert + suffix;
        input.value = newValue;
        const newPos = prefix.length + truncatedInsert.length;
        setCaret(input, newPos);
        applyValue(newValue);
    };

    const compositionStartHandler = () => {
        isComposingRef.current = true;
    };

    const compositionEndHandler = (e: React.CompositionEvent<any>) => {
        isComposingRef.current = false;
        processInput(e.target as HTMLInputElement);
    };

    const keyDownHandler = (e: React.KeyboardEvent) => {
        if (isComposingRef.current && isConstrained) return;
        const charCode = (typeof e.which == "number") ? e.which : e.keyCode;
        if (charCode === /*enter*/13 || props.treatSpaceAsEnter && charCode === /*space*/32) {
            let validatedValue = value;
            if (validator) {
                validatedValue = validator(value, initialValue || "");
                setValue(validatedValue);
                lastCommittedValueRef.current = validatedValue;
            }
            if (onEnterKey) {
                e.preventDefault();
                onEnterKey(validatedValue);
            }
        } else if (options && e.key === "ArrowDown") {
            if (expanded) {
                document.getElementById(getDropdownOptionId(optionValues[0]))?.focus();
            } else {
                expandButtonClickHandler();
                setTimeout(() => {
                    document.getElementById(getDropdownOptionId(optionValues[0]))?.focus();
                }, 0);
            }
            e.preventDefault();
            e.stopPropagation();
        } else if (options && expanded && e.key === "ArrowUp") {
            document.getElementById(getDropdownOptionId(optionValues[optionValues.length - 1]))?.focus();
            e.preventDefault();
            e.stopPropagation();
        }
    }

    const captureEscapeKey = (e: React.KeyboardEvent) => {
        if (e.code !== "Escape") return;
        (e.target as HTMLElement).blur();
        expandButtonClickHandler();
        document.getElementById(id)?.focus();
        e.stopPropagation();
        e.preventDefault();
    }

    const iconClickHandler = () => {
        if (onIconClick) onIconClick(value);
    }

    const expandButtonClickHandler = () => {
        if (options) {
            setExpanded(!expanded);
        }
    }

    const focusHandler = () => {
        if (onFocus) {
            onFocus(value);
        }
    }

    const blurHandler = () => {
        let currentValue = value;
        if (isComposingRef.current) {
            isComposingRef.current = false;
            currentValue = sanitizeValue(value);
            applyValue(currentValue);
        }
        let validatedValue = currentValue;
        if (validator) {
            validatedValue = validator(currentValue, initialValue || "");
            setValue(validatedValue);
            lastCommittedValueRef.current = validatedValue;
        }
        if (onBlur) {
            onBlur(validatedValue);
        }
        if (!preserveValueOnBlur) {
            setValue("");
            lastCommittedValueRef.current = "";
        }
    }

    const containerBlurHandler = (e: React.FocusEvent) => {
        if (expanded && !container.contains(e.relatedTarget as HTMLElement)) {
            setExpanded(false);
        }
    }

    const optionClickHandler = (option: string) => {
        setExpanded(false);

        const value = options[option];
        setValue(value);
        lastCommittedValueRef.current = value;
        if (onOptionSelected) {
            onOptionSelected(value);
        }

        document.getElementById(id)?.focus();
    }

    const getDropdownOptionId = (option: string) => {
        if (!optionValues.length) {
            return undefined;
        }

        const index = optionValues.indexOf(option);
        if (index === -1) {
            return undefined;
        }

        const sanitized = sanitizeForDomId(option);
        return `dropdown-item-${index}-${sanitized}`;
    }

    return (
        <div className={classList("common-input-wrapper", disabled && "disabled", className)} onBlur={containerBlurHandler} ref={handleContainerRef}>
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
                    value={value}
                    readOnly={!!readOnly}
                    autoFocus={autoFocus}
                    onClick={clickHandler}
                    onChange={changeHandler}
                    onPaste={pasteHandler}
                    onCompositionStart={compositionStartHandler}
                    onCompositionEnd={compositionEndHandler}
                    onKeyDown={keyDownHandler}
                    onBlur={blurHandler}
                    onFocus={focusHandler}
                    autoComplete={autoComplete ? "" : "off"}
                    autoCorrect={autoComplete ? "" : "off"}
                    autoCapitalize={autoComplete ? "" : "off"}
                    spellCheck={autoComplete}
                    maxLength={maxLength}
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
                {options && <Button
                        leftIcon={expanded ? "fas fa-chevron-up" : "fas fa-chevron-down"}
                        title={iconTitle}
                        disabled={disabled}
                        ariaHasPopup="listbox"
                        ariaExpanded={expanded}
                        ariaLabel={ariaLabel}
                        tabIndex={-1}
                        onClick={expandButtonClickHandler} />}
            </div>
            {expanded &&
                <FocusList role="listbox"
                    className="common-menu-dropdown-pane common-dropdown-shadow"
                    childTabStopId={getDropdownOptionId(value) ?? getDropdownOptionId(optionValues[0])}
                    aria-labelledby={id}
                    useUpAndDownArrowKeys={true}>
                        <ul role="presentation"
                        onKeyDown={captureEscapeKey}>
                            { Object.keys(options).map(option =>
                                <li key={option} role="presentation">
                                    <Button
                                        title={option}
                                        label={option}
                                        id={getDropdownOptionId(options[option])}
                                        className={classList("common-dropdown-item")}
                                        onClick={() => optionClickHandler(option)}
                                        ariaSelected={getDropdownOptionId(options[option]) === getDropdownOptionId(value ?? initialValue)}
                                        role="option" />
                                </li>
                            )}
                        </ul>
                </FocusList>
            }
        </div>
    );
}
