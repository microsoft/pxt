import * as React from "react";
import { classList } from "../../util";
import { Message, MessagePart } from "./chat.types";
import { ChatRegistry, createRegistry, unknownKindRenderer, PartRenderContext } from "./chat.registry";

export interface ChatMessageListProps {
    id?: string;
    className?: string;
    style?: React.CSSProperties;

    messages: Message[];
    registry?: ChatRegistry;

    // How many items from the tail to keep rendered (simple tail-biased windowing)
    tailSize?: number; // default 75
    overscan?: number; // default 12

    onAppend?: (m: Message) => void;
}

export const ChatMessageList = (props: ChatMessageListProps) => {
    const { id, className, style, messages, registry, tailSize = 75, overscan = 12, onAppend } = props;

    const mergedRegistry = React.useMemo(() => createRegistry(registry), [registry]);

    const containerRef = React.useRef<HTMLDivElement | null>(null);
    const lastMessageRef = React.useRef<HTMLElement | null>(null);

    // ephemeral UI state kept outside the transcript; keyed by message id
    const [uiState, setUiState] = React.useState<{ [msgId: string]: any }>({});

    const updateUiState = React.useCallback((msgId: string, slot: string, value: any) => {
        setUiState((prev) => {
            const next = { ...(prev || {}) };
            const entry = { ...(next[msgId] || {}) };
            entry[slot] = value;
            next[msgId] = entry;
            return next;
        });
    }, []);

    const atBottomRef = React.useRef<boolean>(true);
    const setAtBottom = (v: boolean) => {
        atBottomRef.current = v;
    };

    // compute windowed indexes (simple tail-window strategy)
    const startIndex = Math.max(0, messages.length - tailSize - overscan);
    const visibleMessages = messages.slice(startIndex);

    // IntersectionObserver to track whether the tail is in view.
    React.useEffect(() => {
        const observerRoot = containerRef.current;
        if (!observerRoot) return () => {};

        const observer = new IntersectionObserver(
            (entries) => {
                for (const e of entries) {
                    // when last message is visible, consider we are at bottom
                    if (e.target === lastMessageRef.current) {
                        setAtBottom(e.isIntersecting);
                    }
                }
            },
            { root: observerRoot, threshold: 0.6 }
        );

        if (lastMessageRef.current) {
            observer.observe(lastMessageRef.current);
        }
        return () => {
            observer.disconnect();
        };
    }, [visibleMessages.length]);

    // Keep previous messages length to detect append
    const prevLen = React.useRef<number>(messages.length);
    React.useEffect(() => {
        if (messages.length > prevLen.current) {
            // messages appended at the end
            const appended = messages.slice(prevLen.current);
            appended.forEach((m) => onAppend?.(m));

            // if the user was at bottom, scroll to end
            if (atBottomRef.current && containerRef.current) {
                // use requestAnimationFrame to avoid layout thrash
                requestAnimationFrame(() => {
                    if (!containerRef.current) return;
                    containerRef.current.scrollTop = containerRef.current.scrollHeight;
                });
            }
        }
        prevLen.current = messages.length;
    }, [messages, onAppend]);

    // When content size changes (images/cards), scroll to bottom if we were at bottom
    const handleContentResize = React.useCallback(() => {
        if (atBottomRef.current && containerRef.current) {
            requestAnimationFrame(() => {
                if (!containerRef.current) return;
                containerRef.current.scrollTop = containerRef.current.scrollHeight;
            });
        }
    }, []);

    // For SSR safety: guard window usage (none required here)

    return (
        <div id={id} role="log" aria-live="polite" className={classList("common-chat-message-list", className)} ref={(el) => (containerRef.current = el)} style={style}>
            {visibleMessages.map((m, i) => {
                const globalIndex = startIndex + i;
                const isLast = globalIndex === messages.length - 1;
                return (
                    <article
                        key={m.id}
                        ref={isLast ? (el) => (lastMessageRef.current = el) : undefined}
                        className={classList("common-chat-message", m.author === "user" ? "from-user" : "from-agent")}
                        aria-label={m.author ? `${m.author} ${m.timestamp ?? ""}` : undefined}
                        role="article"
                    >
                        <div className="common-chat-message-meta">
                            <div className="common-chat-message-author">{m.author}</div>
                            {m.timestamp && <time className="common-chat-message-ts">{new Date(m.timestamp).toLocaleTimeString()}</time>}
                        </div>
                        <div className="common-chat-message-body">
                            {m.parts.map((p: MessagePart, partIdx: number) => {
                                const entry = mergedRegistry[p.kind] || unknownKindRenderer;
                                const ctx: PartRenderContext = {
                                    message: m,
                                    partIndex: partIdx,
                                    uiState: uiState[m.id],
                                    updateUiState: (slot: string, v: any) => updateUiState(m.id, slot, v),
                                    onContentResize: handleContentResize,
                                };
                                return (
                                    <div className={classList("common-chat-message-part", `kind-${p.kind}`)} key={partIdx}>
                                        {entry.render(p as any, ctx)}
                                    </div>
                                );
                            })}
                        </div>
                    </article>
                );
            })}
        </div>
    );
};

export default ChatMessageList;
