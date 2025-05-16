import css from "./styling/NetView.module.scss";
import sharedcss from "./styling/Shared.module.scss";
import { useContext, useMemo, useRef } from "react";
import { useSyncExternalStore } from "use-sync-external-store/shim";
import { AppStateContext } from "@/state/Context";
import { getNetState } from "@/state/helpers";
import { Input } from "react-common/components/controls/Input";
import { Button } from "react-common/components/controls/Button";
import { Checkbox } from "react-common/components/controls/Checkbox";
import { classList } from "react-common/components/util";
import { showToast, startLoadingGame } from "@/transforms";
import { makeToast } from "./Toaster";
import * as collabClient from "@/services/collabClient";
import { setNetState } from "@/state/actions";
import { Strings } from "@/constants";
import { JoinCodeGroup } from "./JoinCodeGroup";
import { MeGroup } from "./MeGroup";
import { PresenceGroup } from "./PresenceGroup";
import { ChatGroup } from "./ChatGroup";
import { SimulatorGroup } from "./SimulatorGroup";
import { debounce } from "@/utils";

export function HostView() {
    const context = useContext(AppStateContext);
    const gameLinkRef = useRef<HTMLInputElement>(null);
    const { state, dispatch } = context;
    const netState = getNetState("host", context);
    const session = useSyncExternalStore(collabClient.sessionStore.subscribe, collabClient.sessionStore.getSnapshot);
    const { realNames, chatEnabled } = session;

    const toggleRealNames = useMemo(
        () =>
            debounce(() => {
                collabClient.setSessionValue("realNames", !realNames);
            }, 100),
        [realNames]
    );

    const toggleChatEnabled = useMemo(
        () =>
            debounce(() => {
                collabClient.setSessionValue("chatEnabled", !chatEnabled);
            }, 100),
        [chatEnabled]
    );

    if (!netState) {
        return null;
    }

    const loadGame = () => {
        const gameLink = gameLinkRef.current?.value;
        const shareCode = pxt.Cloud.parseScriptId(gameLink || "");
        if (!shareCode) return;
        startLoadingGame(shareCode);
    };

    return (
        <div className={css["view"]}>
            <div className={classList(css["panel"], css["controls"])}>
                <div className={css["group"]}>
                    <p className={css["label"]}>
                        {lf("Game Link")}
                        <i className={classList(css["help"], "fas fa-question-circle")} onClick={() => {}}></i>
                    </p>
                    <div className={css["share-link"]}>
                        <Input
                            className={css["share-link"]}
                            handleInputRef={gameLinkRef}
                            placeholder={lf("Paste your game link here")}
                            selectOnClick={true}
                            onEnterKey={loadGame}
                        />
                        <Button
                            className={classList(sharedcss["button"], sharedcss["primary"])}
                            label={lf("Load")}
                            title={lf("Load")}
                            onClick={loadGame}
                        />
                    </div>
                </div>
                <p></p>
                <JoinCodeGroup />
                <p></p>
                <MeGroup />
                <p></p>
                <div className={css["group"]}>
                    <p className={css["label"]}>{lf("Options")}</p>
                    <Checkbox
                        id="realNamesCheckbox"
                        isChecked={realNames}
                        onChange={toggleRealNames}
                        label={lf("Show Real Names")}
                    ></Checkbox>
                    <Checkbox
                        id="chatEnabledCheckbox"
                        isChecked={chatEnabled}
                        onChange={toggleChatEnabled}
                        label={lf("Chat Enabled")}
                    ></Checkbox>
                </div>
                <div className={sharedcss["stretch"]}></div>
                <div className={css["group"]}>
                    <Button
                        className={classList(
                            sharedcss["button"],
                            sharedcss["destructive"],
                            sharedcss["taller"],
                            sharedcss["w100"]
                        )}
                        label={lf("End Session")}
                        title={lf("End Session")}
                        onClick={() => {
                            collabClient.collabOver("ended");
                            dispatch(setNetState(undefined));
                        }}
                    />
                </div>
            </div>
            <div className={classList(css["panel"], css["presence"])}>
                <PresenceGroup />
                <p></p>
                <ChatGroup className={sharedcss["stretch"]} />
            </div>
            <p></p>
            <div className={classList(css["panel"], css["sim"])}>
                <SimulatorGroup />
            </div>
        </div>
    );
}
