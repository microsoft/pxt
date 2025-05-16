import css from "./styling/NetView.module.scss";
import sharedcss from "./styling/Shared.module.scss";
import { useContext, useMemo, useRef } from "react";
import { useSyncExternalStore } from "use-sync-external-store/shim";
import { AppStateContext } from "@/state/Context";
import { getDisplayName, getNetState } from "@/state/helpers";
import { Input } from "react-common/components/controls/Input";
import { Button } from "react-common/components/controls/Button";
import { Checkbox } from "react-common/components/controls/Checkbox";
import { classList } from "react-common/components/util";
import { showToast, startLoadingGame } from "@/transforms";
import { makeToast } from "./Toaster";
import * as collabClient from "@/services/collabClient";
import { setNetState } from "@/state/actions";
import { ViewPlayer } from "@/types";
import { Strings } from "@/constants";

export function PresenceGroup({ className }: { className?: string }) {
    const presence = useSyncExternalStore(
        collabClient.playerPresenceStore.subscribe,
        collabClient.playerPresenceStore.getSnapshot
    );

    const players: ViewPlayer[] = useMemo(() => {
        return presence.sort((a, b) => a.id.localeCompare(b.id));
    }, [presence]);

    return (
        <div className={classList(css["group"], className)}>
            <p className={css["label"]}>{lf("Players")}</p>
            <div className={css["players"]}>
                {players.map(p => (
                    <div key={p.id} className={css["player"]}>
                        <span className={css["name"]}>{getDisplayName(p, Strings.MissingName)}</span>
                        {p.role === "host" && <span className={classList(css["pill"], css["host"])}>{lf("host")}</span>}
                        {p.isMe && <span className={classList(css["pill"], css["me"])}>{lf("me")}</span>}
                        {p.currentGame && (
                            <span className={classList(css["pill"], css["playing"])}>{lf("playing")}</span>
                        )}
                        <Button
                            className={css["actions"]}
                            title={lf("Actions")}
                            leftIcon="fas fa-ellipsis-v"
                            onClick={() => {}}
                        />
                    </div>
                ))}
            </div>
        </div>
    );
}
