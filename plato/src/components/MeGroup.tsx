import css from "./styling/NetView.module.scss";
import sharedcss from "./styling/Shared.module.scss";
import { useContext, useMemo, useRef } from "react";
import { useSyncExternalStore } from "use-sync-external-store/shim";
import { AppStateContext } from "@/state/Context";
import { Button } from "react-common/components/controls/Button";
import { classList } from "react-common/components/util";
import { generateRandomName } from "@/utils";
import * as collabClient from "@/services/collabClient";
import { debounce } from "@/utils";
import { ViewPlayer } from "@/types";
import { setPlayerValue } from "@/transforms";
import { Strings } from "@/constants";
import { getDisplayName } from "@/state/helpers";

export function MeGroup() {
    const context = useContext(AppStateContext);
    const { state } = context;
    const { netState } = state;
    const sessionState = useSyncExternalStore(
        collabClient.sessionStore.subscribe,
        collabClient.sessionStore.getSnapshot
    );
    const { shareCode, realNames } = sessionState;

    const presence = useSyncExternalStore(
        collabClient.playerPresenceStore.subscribe,
        collabClient.playerPresenceStore.getSnapshot
    );

    const players: ViewPlayer[] = useMemo(() => {
        if (!netState) return [];
        return presence.sort((a, b) => a.id.localeCompare(b.id));
    }, [presence, netState]);

    const me: ViewPlayer | undefined = useMemo(() => {
        if (!netState) return undefined;
        return players.find(p => p.isMe);
    }, [players, netState]);

    const debounceRegenerateName = useMemo(
        () =>
            debounce(() => {
                if (!me) return;
                const name = generateRandomName();
                setPlayerValue(me.id, "name", name);
            }, 100),
        [me]
    );

    const joinedToGame = useMemo(() => {
        if (!shareCode || !me) return false;
        return me.currentGame === shareCode;
    }, [me?.currentGame, shareCode]);

    const isPlatoGame = useMemo(() => {
        const platoExtVersion = netState?.platoExtVersion ?? 0;
        return platoExtVersion > 0;
    }, [netState]);

    if (!netState) {
        return null;
    }

    const joinGame = () => {
        if (!me) return false;
        const { shareCode } = sessionState;
        if (!shareCode) return false;
        setPlayerValue(me.id, "currentGame", shareCode);
    };

    const leaveGame = () => {
        if (!me) return;
        setPlayerValue(me.id, "currentGame", undefined);
    };

    return (
        <div className={css["group"]}>
            <p className={css["label"]}>{lf("Me")}</p>
            <div className={classList(sharedcss["horz"], sharedcss["wrap"], sharedcss["gap50"])}>
                <span>{getDisplayName(me, "")}</span>
                {!realNames && me?.name && (
                    <Button
                        className={classList(sharedcss["button"], sharedcss["iconic"], sharedcss["smaller"])}
                        title={lf("Change Name")}
                        rightIcon="fas fa-sync"
                        onClick={debounceRegenerateName}
                    />
                )}
            </div>
            {isPlatoGame && (
                <div
                    className={classList(
                        sharedcss["horz"],
                        sharedcss["wrap"],
                        sharedcss["gap50"],
                        sharedcss["stretch"],
                        sharedcss["items-right"]
                    )}
                >
                    {!joinedToGame && (
                        <Button
                            className={classList(sharedcss["button"], sharedcss["primary"])}
                            label={lf("Join Game")}
                            title={lf("Join Game")}
                            onClick={joinGame}
                        />
                    )}
                    {joinedToGame && (
                        <Button
                            className={classList(sharedcss["button"], sharedcss["destructive"])}
                            label={lf("Leave Game")}
                            title={lf("Leave Game")}
                            onClick={leaveGame}
                        />
                    )}
                </div>
            )}
        </div>
    );
}
