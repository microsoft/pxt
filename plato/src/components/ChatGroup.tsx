import css from "./styling/NetView.module.scss";
import sharedcss from "./styling/Shared.module.scss";
import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { useSyncExternalStore } from "use-sync-external-store/shim";
import { AppStateContext } from "@/state/Context";
import { getNetState, getIsHost, getDisplayName } from "@/state/helpers";
import * as collabClient from "@/services/collabClient";
import { classList } from "react-common/components/util";
import { Input } from "react-common/components/controls/Input";
import { Button } from "react-common/components/controls/Button";
import { ChatMessage } from "@/types";

function TextChatMessage({ message, fromClientId }: { message: string, fromClientId: string }) {
    return (
        <>
            <div className={classList(css["from"], sharedcss["username"])}>{getDisplayName(fromClientId, lf("[gone]"))}</div>
            <div className={css["text"]}>{message}</div>
        </>
    );
}

export function ChatGroup({ className }: { className?: string }) {
    const context = useContext(AppStateContext);
    const chatInputRef = useRef<HTMLInputElement | null>();
    const [inputRegenKey, setInputRegenKey] = useState(0);
    const session = useSyncExternalStore(collabClient.sessionStore.subscribe, collabClient.sessionStore.getSnapshot);
    const { chatEnabled, chatMessages } = session;
    // Inclusion of `presence` here is enough to trigger a re-render when a player changes their name.
    // It appears unused, but is in fact needed [⚆_⚆]
    const presence = useSyncExternalStore(collabClient.playerPresenceStore.subscribe, collabClient.playerPresenceStore.getSnapshot);

    const isHost = getIsHost(context);

    const chatControlsEnabled = useMemo(() => {
        return chatEnabled || isHost;
    }, [chatEnabled, isHost]);

    const handleChatMessageRef = (el: HTMLInputElement | null) => {
        if (el && !chatControlsEnabled) {
            el.value = "";
        }
        chatInputRef.current = el;
    };

    const sendChatMessage = () => {
        const curr = chatInputRef.current;
        if (!curr) return;
        const message = curr.value;
        if (!message) return;
        curr.value = "";
        setInputRegenKey(inputRegenKey + 1);
        collabClient.sendChatMessage(message);
    }

    const chatMessageKeys = useMemo(() => {
        return Array.from(chatMessages.keys());
    }, [chatMessages]);

    const chatMessageList: ChatMessage[] = useMemo(() => {
        return chatMessageKeys
            .map(key => chatMessages.get(key))
            .filter(m => !!m)
            .sort((a, b) => b!.id - a!.id) as ChatMessage[];
    }, [chatMessageKeys]);

    return (
        <div className={classList(css["group"], className)}>
            <p className={css["label"]}>{lf("Chat")}</p>
            <div className={css["chat-messages"]}>
                <div className={css["scrollable"]}>
                    {chatMessageList.map((m, index) => (
                        <div key={index} className={css["entry"]}>
                            {m.payload.type === "text" && (<TextChatMessage message={m.payload.text} fromClientId={m.fromClientId} />)}
                        </div>
                    ))}
                </div>
            </div>
            <p></p>
            <div className={classList(sharedcss["horz"], sharedcss["gap25"])}>
                <Input
                    key={inputRegenKey}
                    className={classList(sharedcss["w100"])}
                    handleInputRef={handleChatMessageRef}
                    disabled={!chatControlsEnabled}
                    placeholder={chatControlsEnabled ? lf("Type a message") : lf("Chat disabled")}
                    onEnterKey={() => {
                        sendChatMessage();
                        requestAnimationFrame(() => {
                            chatInputRef.current?.focus();
                        });
                    }}
                />
                <Button
                    className={classList(sharedcss["button"], sharedcss["primary"])}
                    label={lf("Send")}
                    title={lf("Send")}
                    onClick={sendChatMessage}
                    disabled={!chatControlsEnabled}
                />
            </div>
        </div>
    );
}
