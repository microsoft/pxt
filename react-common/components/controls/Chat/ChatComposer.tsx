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
    const { onSend, className, style, placeholder, disabled, busy } = props;
    const [value, setValue] = React.useState("");
    const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);

    React.useEffect(() => {
        // auto resize on mount
        if (textareaRef.current) {
            textareaRef.current.style.height = "1px";
            textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
        }
    }, []);

    const maybeResize = () => {
        if (!textareaRef.current) return;
        textareaRef.current.style.height = "1px";
        textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            // send
            e.preventDefault();
            const trimmed = value.trim();
            if (!trimmed) return;
            onSend(trimmed);
            setValue("");
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setValue(e.target.value);
        maybeResize();
    };

    const doSend = () => {
        const trimmed = value.trim();
        if (!trimmed) return;
        onSend(trimmed);
        setValue("");
        if (textareaRef.current) {
            textareaRef.current.style.height = "1px";
        }
    };

    return (
        <div className={classList("common-chat-composer", className)} style={style}>
            <textarea
                ref={textareaRef}
                className={classList("common-textarea", "common-chat-composer-textarea")}
                placeholder={placeholder || lf("Type a message...")}
                value={value}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                aria-label={placeholder || lf("Message input")}
                disabled={disabled}
            />
            <Button
                className={classList("common-chat-send-button")}
                title={lf("Send")}
                label={busy ? <div className="common-spinner" /> : lf("Send")}
                onClick={doSend}
                disabled={disabled || busy || value.trim().length === 0}
            />
        </div>
    );
};

export default ChatComposer;
