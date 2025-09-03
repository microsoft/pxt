import * as React from "react";
import { classList, ContainerProps } from "../../util";
import ChatMessageList from "./ChatMessageList";
import ChatComposer from "./ChatComposer";
import { ChatRegistry, createRegistry } from "./chat.registry";
import { Message } from "./chat.types";

export interface ChatProps extends ContainerProps {
    messages: Message[];
    onSend: (messageOrText: Message | string) => void;
    onAppend?: (message: Message) => void;
    registry?: ChatRegistry;
    uploadHandlers?: any;
    tailSize?: number;
    overscan?: number;
    style?: React.CSSProperties;
}

export const Chat = (props: ChatProps) => {
    const { id, className, style, messages, onSend, onAppend, registry, tailSize, overscan } = props;

    const mergedRegistry = React.useMemo(() => createRegistry(registry), [registry]);

    const handleSend = (text: string) => {
        // top-level convenience: allow composer to call with text
        const message: Message = {
            id: `${Date.now()}`,
            parts: [{ kind: "text", text }],
            author: "user",
            timestamp: new Date().toISOString(),
        };
        if (onSend) onSend(message);
    };

    return (
        <div id={id} className={classList("common-chat", className)} style={style}>
            <ChatMessageList messages={messages} registry={mergedRegistry} onAppend={onAppend} tailSize={tailSize} overscan={overscan} />
            <ChatComposer onSend={handleSend} />
        </div>
    );
};

export default Chat;
