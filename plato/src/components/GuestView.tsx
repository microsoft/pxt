import css from "./styling/NetView.module.scss";
import sharedcss from "./styling/Shared.module.scss";
import * as collabClient from "@/services/collabClient";
import { useContext } from "react";
import { AppStateContext } from "@/state/Context";
import { classList } from "react-common/components/util";
import { getNetState } from "@/state/helpers";
import { Strings } from "@/constants";
import { makeToast } from "./Toaster";
import { showToast } from "@/transforms";
import { Button } from "react-common/components/controls/Button";
import { setNetState } from "@/state/actions";
import { JoinCodeGroup } from "./JoinCodeGroup";
import { MeGroup } from "./MeGroup";
import { PresenceGroup } from "./PresenceGroup";
import { ChatGroup } from "./ChatGroup";
import { SimulatorGroup } from "./SimulatorGroup";

export function GuestView() {
    const context = useContext(AppStateContext);
    const { state, dispatch } = context;
    const netState = getNetState("guest", context);

    if (!netState) {
        return null;
    }

    return (
        <div className={css["view"]}>
            <div className={classList(css["panel"], css["controls"])}>
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
