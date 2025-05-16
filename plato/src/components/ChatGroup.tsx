import css from "./styling/NetView.module.scss";
import sharedcss from "./styling/Shared.module.scss";
import { useContext, useEffect, useMemo, useRef } from "react";
import { useSyncExternalStore } from "use-sync-external-store/shim";
import { AppStateContext } from "@/state/Context";
import { getNetState, getIsHost } from "@/state/helpers";
import * as collabClient from "@/services/collabClient";
import { classList } from "react-common/components/util";
import { Input } from "react-common/components/controls/Input";
import { Button } from "react-common/components/controls/Button";
import { debounce } from "@/utils";

export function ChatGroup({ className }: { className?: string }) {
    const context = useContext(AppStateContext);
    const chatMessageRef = useRef<HTMLInputElement | null>();
    const session = useSyncExternalStore(collabClient.sessionStore.subscribe, collabClient.sessionStore.getSnapshot);
    const { chatEnabled } = session;

    const isHost = getIsHost(context);

    const chatControlsEnabled = useMemo(() => {
        return chatEnabled || isHost;
    }, [chatEnabled, isHost]);

    const handleChatMessageRef = (el: HTMLInputElement | null) => {
        if (el && !chatEnabled) {
            el.value = "";
        }
        chatMessageRef.current = el;
    };

    const sendChatMessage = useMemo(
        () =>
            debounce(() => {
                const curr = chatMessageRef.current;
                if (!curr) return;
                const message = curr.value;
                if (!message) return;
                curr.value = "";
                //collabClient.sendChatMessage(message);
            }, 100),
        [chatMessageRef]
    );

    return (
        <div className={classList(css["group"], className)}>
            <p className={css["label"]}>{lf("Chat")}</p>
            <div className={css["chat-dialog"]}></div>
            <p></p>
            <div className={classList(sharedcss["horz"], sharedcss["gap25"])}>
                <Input
                    className={classList(sharedcss["w100"])}
                    handleInputRef={handleChatMessageRef}
                    disabled={!chatControlsEnabled}
                    placeholder={chatControlsEnabled ? lf("Type a message") : lf("Chat disabled")}
                    onEnterKey={sendChatMessage}
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
