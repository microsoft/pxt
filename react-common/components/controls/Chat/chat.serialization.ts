import { ChatEnvelope, Message, AttachmentManifest, CHAT_SCHEMA_VERSION } from "./chat.types";

export function exportEnvelope(messages: Message[], attachments?: AttachmentManifest): ChatEnvelope {
    // Ensure a minimal, serializable copy (no functions/JSX)
    const safeMessages = messages.map((m) => ({ ...m, parts: m.parts.map((p) => ({ ...p })) }));
    return {
        schemaVersion: CHAT_SCHEMA_VERSION,
        exportedAt: new Date().toISOString(),
        messages: safeMessages,
        attachments,
    };
}

export function exportEnvelopeToJson(messages: Message[], attachments?: AttachmentManifest): string {
    return JSON.stringify(exportEnvelope(messages, attachments));
}

export function importEnvelope(raw: string | any): ChatEnvelope {
    let obj: any;
    if (typeof raw === "string") {
        obj = JSON.parse(raw);
    } else {
        obj = raw;
    }

    if (!obj || typeof obj !== "object") throw new Error("Invalid envelope: not an object");
    const schemaVersion = obj.schemaVersion || 0;
    if (schemaVersion !== CHAT_SCHEMA_VERSION) {
        // TODO: Add migration here
        throw new Error(`Unsupported envelope schemaVersion: ${schemaVersion}`);
    }

    const messages: Message[] = (obj.messages || []).map((m: any) => ({
        id: m.id,
        parts: (m.parts || []).map((p: any) => ({ ...p })),
        author: m.author,
        timestamp: m.timestamp,
        metadata: m.metadata,
    }));

    const attachments: AttachmentManifest | undefined = obj.attachments;

    return {
        schemaVersion,
        exportedAt: obj.exportedAt || new Date().toISOString(),
        messages,
        attachments,
    };
}
