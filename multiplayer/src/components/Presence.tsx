import { useCallback, useContext, useMemo, useState, useRef } from "react";
import { AppStateContext } from "../state/AppStateContext";
import * as util from "../util";
import ReactionEmitter from "./ReactionEmitter";

export default function Render() {
    const { state } = useContext(AppStateContext);
    const { presence } = state;

    const slotRef = useRef<(HTMLDivElement | null)[]>([]);

    const players = useMemo(() => {
        return presence.users.filter(user => user.slot < 5);
    }, [presence]);

    const spectators = useMemo(() => {
        return presence.users.filter(user => user.slot >= 5);
    }, [presence]);

    return (
        <div>
            <div className="tw-text-lg tw-font-bold">{lf("Players")}</div>
            <div className="tw-flex tw-flex-row tw-items-center tw-justify-center tw-gap-2 tw-mt-2">
                {[1, 2, 3, 4].map(slot => {
                    const user = players.find(u => u.slot === slot);
                    return (
                        <div
                            key={slot}
                            ref={ref => (slotRef.current[slot] = ref)}
                            className="tw-flex tw-p-1 tw-border tw-border-slate-300 tw-rounded-full tw-min-h-[2.25rem] tw-min-w-[2.25rem] tw-bg-neutral-50"
                        >
                            {user?.name}
                            {user && (
                                <ReactionEmitter
                                    clientId={user.id}
                                    parentRef={slotRef.current[slot]!}
                                />
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
