/** @format */

import {
    ChatEnvelope,
    Message,
    AttachmentManifest,
    CHAT_SCHEMA_VERSION,
    isValidMessage,
    sanitizeMessage,
} from "./chat.types";

export interface SerializationOptions {
    validateMessages?: boolean;
    sanitizeMessages?: boolean;
}

export function exportEnvelope(
    messages: Message[],
    attachments?: AttachmentManifest,
    options: SerializationOptions = { validateMessages: true, sanitizeMessages: true }
): ChatEnvelope {
    let processedMessages = messages;

    if (options.validateMessages || options.sanitizeMessages) {
        processedMessages = messages
            .filter((m) => (options.validateMessages ? isValidMessage(m) : true))
            .map((m) => (options.sanitizeMessages ? sanitizeMessage(m) : m));
    }

    // Ensure a minimal, serializable copy (no functions/JSX)
    const safeMessages = processedMessages.map((m) => ({
        ...m,
        parts: m.parts.map((p) => ({ ...p })),
    }));

    return {
        schemaVersion: CHAT_SCHEMA_VERSION,
        exportedAt: new Date().toISOString(),
        messages: safeMessages,
        attachments: attachments ? { ...attachments } : undefined,
    };
}

export function exportEnvelopeToJson(
    messages: Message[],
    attachments?: AttachmentManifest,
    options?: SerializationOptions
): string {
    try {
        return JSON.stringify(exportEnvelope(messages, attachments, options));
    } catch (error) {
        throw new Error(`Failed to serialize chat envelope: ${error instanceof Error ? error.message : String(error)}`);
    }
}

export function importEnvelope(raw: string | any): ChatEnvelope {
    let obj: any;

    try {
        if (typeof raw === "string") {
            obj = JSON.parse(raw);
        } else {
            obj = raw;
        }
    } catch (error) {
        throw new Error(`Invalid JSON in chat envelope: ${error instanceof Error ? error.message : String(error)}`);
    }

    if (!obj || typeof obj !== "object") {
        throw new Error("Invalid envelope: not an object");
    }

    const schemaVersion = Number(obj.schemaVersion) || 0;
    if (schemaVersion !== CHAT_SCHEMA_VERSION) {
        // TODO: Add migration logic here
        console.warn(`Unsupported envelope schemaVersion: ${schemaVersion}, expected: ${CHAT_SCHEMA_VERSION}`);
        throw new Error(`Unsupported envelope schemaVersion: ${schemaVersion}`);
    }

    if (!Array.isArray(obj.messages)) {
        throw new Error("Invalid envelope: messages must be an array");
    }

    const messages: Message[] = obj.messages.map((m: any, index: number) => {
        if (!m || typeof m !== "object") {
            throw new Error(`Invalid message at index ${index}: not an object`);
        }

        if (!m.id || typeof m.id !== "string") {
            throw new Error(`Invalid message at index ${index}: missing or invalid id`);
        }

        if (!Array.isArray(m.parts)) {
            throw new Error(`Invalid message at index ${index}: parts must be an array`);
        }

        return {
            id: String(m.id),
            parts: m.parts.map((p: any, partIndex: number) => {
                if (!p || typeof p !== "object") {
                    throw new Error(`Invalid part at message ${index}, part ${partIndex}: not an object`);
                }
                if (!p.kind || typeof p.kind !== "string") {
                    throw new Error(`Invalid part at message ${index}, part ${partIndex}: missing or invalid kind`);
                }
                return { ...p };
            }),
            author: m.author ? String(m.author) : undefined,
            timestamp: m.timestamp ? String(m.timestamp) : undefined,
            metadata: m.metadata,
        };
    });

    const attachments: AttachmentManifest | undefined =
        obj.attachments && typeof obj.attachments === "object" ? obj.attachments : undefined;

    return {
        schemaVersion,
        exportedAt: obj.exportedAt || new Date().toISOString(),
        messages,
        attachments,
    };
}
