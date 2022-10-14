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

    const getPlayerColors = (slot: number | undefined) => {
        switch(slot) {
            case 1:
                return "tw-border-red-800 tw-bg-red-200";
            case 2:
                return "tw-border-blue-800 tw-bg-blue-200";
            case 3:
                return "tw-border-yellow-600 tw-bg-yellow-200";
            case 4:
                return "tw-border-green-800 tw-bg-green-200";
            default:
                return "tw-border-neutral-600 tw-bg-neutral-50";
        }
    }

    return (
        <div className="tw-flex tw-flex-row tw-items-center tw-justify-center tw-gap-2 tw-mt-2">
            {[1, 2, 3, 4].map(slot => {
                const user = players.find(u => u.slot === slot);
                return (
                    <div
                        key={slot}
                        ref={ref => (slotRef.current[slot] = ref)}
                        className={`tw-flex tw-border-2 tw-text-black tw-font-bold tw-rounded-full tw-h-11 tw-w-11 tw-justify-center tw-items-center ${getPlayerColors(user?.slot)}`}>
                        {user?.slot}
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
    );
}
