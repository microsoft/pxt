/** @format */

// Chat public types and serialization envelope

export const CHAT_SCHEMA_VERSION = 1;

export type PartKind = string;

/** Base for message parts; implementations should keep values serializable */
export interface MessagePartBase {
    kind: string; // semantic kind name
    version?: number; // part schema version
    [k: string]: string | number | boolean | null | undefined | object; // Restrict to serializable values only
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

// Validation helpers
export function isValidMessage(obj: any): obj is Message {
    return obj && typeof obj.id === "string" && Array.isArray(obj.parts) && obj.parts.every(isValidMessagePart);
}

export function isValidMessagePart(obj: any): obj is MessagePart {
    return obj && typeof obj.kind === "string" && (obj.version === undefined || typeof obj.version === "number");
}

export function sanitizeMessage(message: Message): Message {
    return {
        ...message,
        id: String(message.id),
        parts: message.parts.filter(isValidMessagePart),
        author: message.author ? String(message.author) : undefined,
        timestamp: message.timestamp ? String(message.timestamp) : undefined,
    };
}
