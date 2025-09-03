import * as React from "react";
import Chat from "./Chat";
import { Message } from "./chat.types";
import { createRegistry } from "./chat.registry";

export default {
    title: "Controls/Chat",
    component: Chat,
};

const sampleMessages: Message[] = [
    {
        id: "1",
        author: "assistant",
        timestamp: new Date().toISOString(),
        parts: [{ kind: "text", text: "Hello! I'm a demo assistant." }],
    },
    {
        id: "2",
        author: "user",
        timestamp: new Date().toISOString(),
        parts: [{ kind: "text", text: "Hi — can you show an image?" }],
    },
    {
        id: "3",
        author: "assistant",
        timestamp: new Date().toISOString(),
        parts: [{ kind: "image", src: "https://via.placeholder.com/240x120.png?text=Demo+Image", alt: "Demo image" }],
    },
];

export const Default = () => {
    const [messages, setMessages] = React.useState<Message[]>(sampleMessages);
    return (
        <div style={{ height: 420, width: 420 }}>
            <Chat
                messages={messages}
                onSend={(msgOrText: any) => {
                    const toAppend: Message =
                        typeof msgOrText === "string"
                            ? {
                                  id: `${Date.now()}`,
                                  author: "user",
                                  timestamp: new Date().toISOString(),
                                  parts: [{ kind: "text", text: msgOrText }],
                              }
                            : msgOrText;
                    setMessages((prev) => [...prev, toAppend]);
                }}
            />
        </div>
    );
};

export const WithCustomCard = () => {
    const registry = createRegistry({
        card: {
            render: (part: any, ctx) => {
                const count = ctx?.uiState?.count || 0;
                return (
                    <div style={{ border: "1px solid var(--pxt-neutral-stencil1)", padding: "0.5rem", borderRadius: "0.25rem" }}>
                        <div>{part.title || "Demo Card"}</div>
                        <div style={{ marginTop: "0.5rem" }}>
                            <button className="common-button" onClick={() => ctx.updateUiState?.("count", count + 1)}>
                                Click +{count}
                            </button>
                        </div>
                    </div>
                );
            },
        },
    });

    const [messages, setMessages] = React.useState<Message[]>([
        { id: "c1", author: "assistant", timestamp: new Date().toISOString(), parts: [{ kind: "card", cardId: "demo", props: { title: "Counter Card" } }] },
    ]);

    return (
        <div style={{ height: 420, width: 420 }}>
            <Chat
                messages={messages}
                registry={registry}
                onSend={(mOrText: any) => {
                    const toAppend: Message =
                        typeof mOrText === "string" ? { id: `${Date.now()}`, author: "user", timestamp: new Date().toISOString(), parts: [{ kind: "text", text: mOrText }] } : mOrText;
                    setMessages((prev) => [...prev, toAppend]);
                }}
            />
        </div>
    );
};

export const LongTranscript = () => {
    const many: Message[] = [];
    for (let i = 0; i < 400; ++i) {
        many.push({ id: `${i}`, author: i % 2 ? "user" : "assistant", timestamp: new Date().toISOString(), parts: [{ kind: "text", text: `Message #${i}` }] });
    }

    const [messages, setMessages] = React.useState<Message[]>(many);

    return (
        <div style={{ height: 420, width: 420 }}>
            <Chat
                messages={messages}
                onSend={(mOrText: any) => {
                    const toAppend: Message =
                        typeof mOrText === "string" ? { id: `${Date.now()}`, author: "user", timestamp: new Date().toISOString(), parts: [{ kind: "text", text: mOrText }] } : mOrText;
                    setMessages((prev) => [...prev, toAppend]);
                }}
                tailSize={40}
                overscan={8}
            />
        </div>
    );
};
