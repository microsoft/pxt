import * as React from "react";
import { classList } from "../../util";
import { Message, MessagePart, TextPart, ImagePart } from "./chat.types";

export type PartRenderContext = {
    message: Message;
    partIndex: number;
    // ephemeral UI state map for the message; consumers can store per-message UI state here
    uiState?: any;
    // update a named slot in the message UI state
    updateUiState?: (slot: string, value: any) => void;
    // callback invoked when a part's rendered content changes size (images, cards)
    onContentResize?: () => void;
};

export interface RegistryEntry<TPart extends MessagePart = MessagePart> {
    /** Render a part to JSX given a context. Must be pure with respect to transcript data. */
    render: (part: TPart, ctx: PartRenderContext) => JSX.Element | null;
    /** Optional migrate hook for upgrading older part versions */
    migrate?: (part: TPart) => TPart;
}

export type ChatRegistry = { [kind: string]: RegistryEntry };

// Minimal fallback renderer
const fallbackRenderer: RegistryEntry = {
    render: (part: MessagePart, ctx: PartRenderContext) => {
        try {
            // Show a safe description of the part
            return (
                <pre className={classList("common-chat-part-fallback")} aria-hidden={true}>
                    {JSON.stringify(part, null, 2)}
                </pre>
            );
        } catch (e) {
            return <div className="common-chat-part-fallback">Unsupported message part</div>;
        }
    },
};

// A tiny demo card to show registry behavior in stories/tests
const demoCardEntry: RegistryEntry = {
    render: (part: MessagePart, ctx: PartRenderContext) => {
        const card = (part as any) || {};
        const count = (ctx?.uiState?.count as number) ?? 0;
        return (
            <div className={classList("common-chat-demo-card")}>
                <div className="common-chat-demo-card-body">{card.title || "Card"}</div>
                <div className="common-chat-demo-card-actions">
                    <button className={classList("common-button")} onClick={() => ctx?.updateUiState?.("count", (count || 0) + 1)}>
                        + {count}
                    </button>
                </div>
            </div>
        );
    },
    migrate: (part: MessagePart) => {
        return part;
    },
};

// default registry entries for text and image
export const defaultRegistry: ChatRegistry = {
    text: {
        render: (part: TextPart) => {
            return <div className="common-chat-part-text">{part.text}</div>;
        },
    },
    image: {
        render: (part: ImagePart, ctx) => {
            const handleLoad = () => {
                ctx?.onContentResize?.();
            };
            return <img src={part.src} alt={part.alt || ""} className={classList("common-chat-part-image")} onLoad={handleLoad} loading="lazy" />;
        },
    },
    card: demoCardEntry,
    // fallback (unknown kinds) will be handled by the list renderer by falling back to fallbackRenderer
};

export function createRegistry(overrides?: ChatRegistry): ChatRegistry {
    if (!overrides) return defaultRegistry;
    return Object.assign({}, defaultRegistry, overrides);
}

export function registerKind(registry: ChatRegistry, kind: string, entry: RegistryEntry) {
    registry[kind] = entry;
}

export const unknownKindRenderer: RegistryEntry = fallbackRenderer;

export default {
    defaultRegistry,
    createRegistry,
    demoCardEntry,
    unknownKindRenderer,
};
