declare var test: any;
declare var expect: any;
declare var jest: any;
declare var describe: any;

import * as React from "react";
import * as ReactDOM from "react-dom";
import { act } from "react-dom/test-utils";
import Chat from "./Chat";
import ChatMessageList from "./ChatMessageList";
import ChatComposer from "./ChatComposer";
import { exportEnvelope, importEnvelope } from "./chat.serialization";
import { Message } from "./chat.types";

function query(selector: string) {
    return document.querySelector(selector) as HTMLElement | null;
}

describe("Chat component basics", () => {
    test("composer sends on Enter (no Shift)", () => {
        let sent: string | null = null;
        let root: HTMLDivElement | null = document.createElement("div");
        document.body.appendChild(root);

        act(() => {
            ReactDOM.render(<ChatComposer onSend={(v) => (sent = v)} />, root);
        });

        const textarea = query(".common-chat-composer-textarea") as HTMLTextAreaElement | null;
        if (!textarea) throw new Error("Textarea not found");

        act(() => {
            textarea.value = "hello world";
            // fire input event to update any internal state (component uses onChange)
            const inputEv = new Event("input", { bubbles: true });
            textarea.dispatchEvent(inputEv);
            const ev = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key: "Enter" });
            textarea.dispatchEvent(ev);
        });

        if (sent !== "hello world") throw new Error(`expected sent 'hello world' got ${sent}`);

        ReactDOM.unmountComponentAtNode(root);
        root.remove();
    });

    test("windowing renders only tail window", () => {
        const many: Message[] = [];
        for (let i = 0; i < 100; ++i) {
            many.push({ id: `m${i}`, author: i % 2 ? "user" : "assistant", timestamp: new Date().toISOString(), parts: [{ kind: "text", text: `message ${i}` }] });
        }

        let root: HTMLDivElement | null = document.createElement("div");
        document.body.appendChild(root);
        act(() => {
            ReactDOM.render(<ChatMessageList messages={many} tailSize={10} overscan={4} />, root);
        });

        const rendered = (root.querySelectorAll(".common-chat-message") || []) as NodeListOf<Element>;
        if (rendered.length !== 14) throw new Error(`expected 14, found ${rendered.length}`);

        ReactDOM.unmountComponentAtNode(root);
        root.remove();
    });

    test("registry custom card renders via Chat", () => {
        const registry = {
            testcard: {
                render: (part: any) => React.createElement("div", { "data-testid": "testcard" }, part.title || "X"),
            },
        } as any;

        const messages: Message[] = [{ id: "c1", author: "assistant", timestamp: new Date().toISOString(), parts: [{ kind: "testcard", title: "Hello" }] }];

        let root: HTMLDivElement | null = document.createElement("div");
        document.body.appendChild(root);
        act(() => {
            ReactDOM.render(<Chat messages={messages} onSend={() => {}} registry={registry} />, root);
        });

        const testcard = root.querySelector('[data-testid="testcard"]');
        if (!testcard) throw new Error("testcard did not render");

        ReactDOM.unmountComponentAtNode(root);
        root.remove();
    });

    test("serialization roundtrip", () => {
        const messages: Message[] = [{ id: "s1", author: "assistant", timestamp: new Date().toISOString(), parts: [{ kind: "text", text: "abc" }] }];
        const envelope = exportEnvelope(messages);
        const json = JSON.stringify(envelope);
        const imported = importEnvelope(json);
        if (imported.schemaVersion !== envelope.schemaVersion) throw new Error("schema mismatch");
        if (!imported.messages || imported.messages.length !== 1) throw new Error("missing message after import");
        if ((imported.messages[0].parts[0] as any).text !== "abc") throw new Error("text mismatch");
    });
});
