/** @format */

import * as React from "react";
import { classList, ContainerProps } from "../../util";
import { Button } from "../Button";

export interface ChatComposerProps extends ContainerProps {
    onSend: (value: string) => void;
    placeholder?: string;
    disabled?: boolean;
    busy?: boolean;
    style?: React.CSSProperties;
}

export const ChatComposer = (props: ChatComposerProps) => {
    const { onSend, className, style, placeholder, disabled, busy, id, ...ariaProps } = props;
    const [value, setValue] = React.useState("");
    const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);
    const resizeTimeoutRef = React.useRef<number>();

    const debouncedResize = React.useCallback(() => {
        if (resizeTimeoutRef.current) {
            clearTimeout(resizeTimeoutRef.current);
        }
        resizeTimeoutRef.current = setTimeout(() => {
            if (!textareaRef.current) return;
            // Reset height to measure scrollHeight accurately
            textareaRef.current.style.height = "auto";
            const newHeight = Math.min(textareaRef.current.scrollHeight, 160); // max ~10rem
            textareaRef.current.style.height = `${newHeight}px`;
        }, 16); // ~1 frame at 60fps
    }, []);

    React.useEffect(() => {
        return () => {
            if (resizeTimeoutRef.current) {
                clearTimeout(resizeTimeoutRef.current);
            }
        };
    }, []);

    React.useEffect(() => {
        // Initial resize
        debouncedResize();
    }, [debouncedResize]);

    const handleKeyDown = React.useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            const trimmed = value.trim();
            if (!trimmed || disabled || busy) return;
            onSend(trimmed);
            setValue("");
            // Reset height after clearing
            requestAnimationFrame(() => {
                if (textareaRef.current) {
                    textareaRef.current.style.height = "auto";
                }
            });
        }
    }, [value, onSend, disabled, busy]);

    const handleChange = React.useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setValue(e.target.value);
        debouncedResize();
    }, [debouncedResize]);

    const doSend = React.useCallback(() => {
        const trimmed = value.trim();
        if (!trimmed || disabled || busy) return;
        onSend(trimmed);
        setValue("");
        requestAnimationFrame(() => {
            if (textareaRef.current) {
                textareaRef.current.style.height = "auto";
                textareaRef.current.focus();
            }
        });
    }, [value, onSend, disabled, busy]);

    return (
        <div className={classList("common-chat-composer", className)} style={style}>
            <textarea
                id={id}
                ref={textareaRef}
                className={classList("common-textarea", "common-chat-composer-textarea")}
                placeholder={placeholder || lf("Type a message...")}
                value={value}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                aria-label={placeholder || lf("Message input")}
                disabled={disabled}
                rows={1}
                style={{ minHeight: "2.5rem", maxHeight: "10rem", resize: "none", overflow: "hidden" }}
                {...ariaProps}
            />
            <Button
                className={classList("common-chat-send-button")}
                title={lf("Send")}
                label={busy ? <div className="common-spinner" /> : lf("Send")}
                onClick={doSend}
                disabled={disabled || busy || value.trim().length === 0}
                aria-keyshortcuts="Enter"
            />
        </div>
    );
};

export default ChatComposer;
