import css from "./styling/NetView.module.scss";
import sharedcss from "./styling/Shared.module.scss";
import { useContext, useMemo, useRef } from "react";
import { useSyncExternalStore } from "use-sync-external-store/shim"
import { AppStateContext } from "@/state/Context";
import { getHostNetState } from "@/state/helpers";
import { Button } from "react-common/components/controls/Button";
import { classList } from "react-common/components/util";
import { generateRandomName } from "@/utils";
import * as collabClient from "@/services/collabClient";
import { debounce } from "@/utils";
import { ViewPlayer } from "@/types";
import { Strings } from "@/constants";

export function MeGroup() {
    const context = useContext(AppStateContext);
    const { state } = context;
    const { netState } = state;
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

    const debounceRegenerateName = useMemo(
        () =>
            debounce(() => {
                const name = generateRandomName();
                collabClient.setName(name);
            }, 100),
        []
    );

    return (
        <div className={css["me-group"]}>
            <p className={css["label"]}>{lf("Me")}</p>
            <div className={classList(sharedcss["horz"], sharedcss["wrap"])}>
                <span>{me?.name || ""}</span>
                {me?.name && <Button
                    className={classList(sharedcss["button"], sharedcss["iconic"])}
                    title={lf("Change Name")}
                    rightIcon="fas fa-sync"
                    onClick={debounceRegenerateName}
                />}
            </div>
            {netState.platoExtVersion && <p></p>}
            {netState.platoExtVersion && <div className={classList(sharedcss["horz"], sharedcss["wrap"])}>
                <Button
                    className={classList(sharedcss["button"], sharedcss["primary"])}
                    label={lf("Join Game")}
                    title={lf("Join Game")}
                    onClick={() => { }}
                />
            </div>}
        </div>
    );
}