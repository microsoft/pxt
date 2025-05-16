import css from "./styling/NetView.module.scss";
import sharedcss from "./styling/Shared.module.scss";
import * as collabClient from "@/services/collabClient";
import { useContext, useRef } from "react";
import { AppStateContext } from "@/state/Context";
import { classList } from "react-common/components/util";
import { getNetState } from "@/state/helpers";
import { Strings } from "@/constants";
import { makeToast } from "./Toaster";
import { showToast } from "@/transforms";
import { Button } from "react-common/components/controls/Button";
import { Input } from "react-common/components/controls/Input";
import { setNetState } from "@/state/actions";
import { JoinCodeGroup } from "./JoinCodeGroup";
import { MeGroup } from "./MeGroup";
import { PresenceGroup } from "./PresenceGroup";
import { ChatGroup } from "./ChatGroup";
import { SimulatorGroup } from "./SimulatorGroup";
import { sendGameSuggestionAsync } from "@/transforms";

export function GuestView() {
    const context = useContext(AppStateContext);
    const { state, dispatch } = context;
    const gameLinkRef = useRef<HTMLInputElement>(null);
    const netState = getNetState("guest", context);

    if (!netState) {
        return null;
    }

    const suggestGame = async () => {
        const gameLink = gameLinkRef.current?.value;
        const shareCode = pxt.Cloud.parseScriptId(gameLink || "");
        if (!shareCode) return;
        await sendGameSuggestionAsync(shareCode);
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
                            onEnterKey={suggestGame}
                        />
                        <Button
                            className={classList(sharedcss["button"], sharedcss["primary"])}
                            label={lf("Suggest")}
                            title={lf("Suggest")}
                            onClick={suggestGame}
                        />
                    </div>
                </div>
                <p></p>
                <MeGroup />
                <div className={sharedcss["stretch"]}></div>
                <div className={css["leave-group"]}>
                    <Button
                        className={classList(
                            sharedcss["button"],
                            sharedcss["destructive"],
                            sharedcss["taller"],
                            sharedcss["w100"]
                        )}
                        label={lf("Leave Session")}
                        title={lf("Leave Session")}
                        onClick={async () => {
                            await collabClient.leaveCollabAsync("left");
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
            <div className={classList(css["panel"], css["sim"])}>
                <SimulatorGroup />
            </div>
        </div>
    );
}
