/** @format */
/// <reference path="../../built/pxtlib.d.ts" />

import * as React from "react";
import { Chat } from "../../react-common/components/controls/Chat/Chat";
import { Message } from "../../react-common/components/controls/Chat/chat.types";

export interface CopilotChatProps {
    // Add any additional props specific to the copilot chat integration
}

export const CopilotChat: React.FC<CopilotChatProps> = (props) => {
    const [messages, setMessages] = React.useState<Message[]>([
        {
            id: "welcome",
            parts: [{ kind: "text", text: "Hello! I'm your coding assistant. How can I help you today?" }],
            author: "assistant",
            timestamp: new Date().toISOString(),
        }
    ]);

    const handleSend = React.useCallback((messageOrText: Message | string) => {
        let message: Message;
        if (typeof messageOrText === "string") {
            message = {
                id: `user-${Date.now()}`,
                parts: [{ kind: "text", text: messageOrText }],
                author: "user",
                timestamp: new Date().toISOString(),
            };
        } else {
            message = messageOrText;
        }

        setMessages(prev => [...prev, message]);

        // TODO: Integrate with actual copilot service
        // For now, just echo back a simple response
        setTimeout(() => {
            const response: Message = {
                id: `assistant-${Date.now()}`,
                parts: [{ kind: "text", text: `I received your message: "${message.parts.find(p => p.kind === "text")?.text || ""}"` }],
                author: "assistant",
                timestamp: new Date().toISOString(),
            };
            setMessages(prev => [...prev, response]);
        }, 1000);
    }, []);

    return (
        <div className="copilot-chat-container" style={{ height: "100%", display: "flex", flexDirection: "column" }}>
            <Chat
                messages={messages}
                onSend={handleSend}
                style={{ flex: 1 }}
            />
        </div>
    );
};

export default CopilotChat;
