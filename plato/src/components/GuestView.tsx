import css from "./styling/NetView.module.scss";
import sharedcss from "./styling/Shared.module.scss";
import * as collabClient from "@/services/collabClient";
import { useContext, useMemo } from "react";
import { useSyncExternalStore } from "use-sync-external-store/shim"
import { AppStateContext } from "@/state/Context";
import { classList } from "react-common/components/util";
import { getGuestNetState } from "@/state/helpers";
import { ViewPlayer } from "@/types";
import { Strings } from "@/constants";
import { makeToast } from "./Toaster";
import { showToast } from "@/transforms";
import { Button } from "react-common/components/controls/Button";
import { setNetState } from "@/state/actions";
import { JoinCodeGroup } from "./JoinCodeGroup";
import { MeGroup } from "./MeGroup";
import { ArcadeSimulator } from "./ArcadeSimulator";

export function GuestView() {
    const context = useContext(AppStateContext);
    const { state, dispatch } = context;
    const netState = getGuestNetState(context);
    const presence = useSyncExternalStore(
        collabClient.playerPresenceStore.subscribe,
        collabClient.playerPresenceStore.getSnapshot,
    );

    const players: ViewPlayer[] = useMemo(() => {
        if (!netState) return [];
        return presence
            .sort((a, b) => a.id.localeCompare(b.id));
    }, [presence, netState]);

    const me: ViewPlayer | undefined = useMemo(() => {
        if (!netState) return undefined;
        return players.find(p => p.isMe);
    }, [players, netState]);

    if (!netState) {
        return null;
    }

    return (
        <div className={css["view"]}>
            <div className={classList(css["panel"], css["controls"])}>
                <MeGroup />
                <div className={css["leave-group"]}>
                    <Button
                        className={classList(sharedcss["button"], sharedcss["destructive"], sharedcss["taller"], sharedcss["w100"])}
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
                <p className={css["label"]}>{lf("Players")}</p>
                <div className={css["players"]}>
                    {players.map(p => (
                        <div key={p.id} className={css["player"]}>
                            <span className={css["name"]}>{p.name}</span>
                            {(p.role === "host") && <span className={classList(css["pill"], css["host"])}>{lf("host")}</span>}
                            {p.isMe && <span className={classList(css["pill"], css["me"])}>{lf("me")}</span>}
                            <Button
                                className={css["actions"]}
                                title={lf("Actions")}
                                leftIcon="fas fa-ellipsis-v"
                                onClick={() => { }}
                            />
                        </div>
                    ))}
                </div>
            </div>
            <div className={classList(css["panel"], css["sim"])}>
                <ArcadeSimulator />
            </div>
        </div>
    );
}
