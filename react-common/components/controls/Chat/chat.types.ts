// Chat public types and serialization envelope

export const CHAT_SCHEMA_VERSION = 1;

export type PartKind = string;

/** Base for message parts; implementations should keep values serializable */
export interface MessagePartBase {
    kind: string; // semantic kind name
    version?: number; // part schema version
    // any additional serializable fields are allowed
    [k: string]: any;
}

export interface TextPart extends MessagePartBase {
    kind: "text";
    text: string;
}

export interface ImagePart extends MessagePartBase {
    kind: "image";
    src: string; // content-addressable URL or data URL
    alt?: string;
    width?: number;
    height?: number;
}

export interface CardPart extends MessagePartBase {
    kind: "card";
    cardId: string; // application-specific card identifier
    props?: any; // serializable card props
}

export type MessagePart = TextPart | ImagePart | CardPart | MessagePartBase;

export interface Message {
    id: string; // unique, stable identifier for the message
    parts: MessagePart[];
    author?: string; // e.g. "user", "assistant", or client id
    timestamp?: string; // ISO timestamp
    metadata?: any; // optional opaque metadata
}

export interface AttachmentManifestEntry {
    contentId: string; // opaque content-addressable id
    contentType: string; // mime-type
    size?: number;
    metadata?: any;
}

export type AttachmentManifest = { [contentId: string]: AttachmentManifestEntry };

export interface ChatEnvelope {
    schemaVersion: number;
    exportedAt: string; // ISO date
    messages: Message[];
    attachments?: AttachmentManifest;
}

// Utility helper: shallow-clone a Message with a new id (used by composer examples)
export function cloneMessageWithId(message: Message, newId: string): Message {
    return {
        ...message,
        id: newId,
        parts: message.parts.map((p) => ({ ...p })),
    };
}
