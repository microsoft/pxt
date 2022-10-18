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
                return "tw-border-[#ED3636] tw-bg-red-300";
            case 2:
                return "tw-border-[#4E4EE9] tw-bg-blue-300";
            case 3:
                return "tw-border-[#C1A916] tw-bg-yellow-300";
            case 4:
                return "tw-border-[#4EB94E] tw-bg-green-300";
            default:
                return "tw-border-neutral-600 tw-bg-neutral-300";
        }
    }

    const getBorder = (slot: number | undefined) => {
        return slot && slot < 5 ? "tw-border-2" : "tw-border-0";
    }

    return (
        <div className="tw-flex tw-flex-row tw-items-center tw-justify-center tw-gap-2">
            {[1, 2, 3, 4].map(slot => {
                const user = players.find(u => u.slot === slot);
                return (
                    <div
                        key={slot}
                        ref={ref => (slotRef.current[slot] = ref)}
                        className={`tw-flex tw-select-none tw-text-black tw-font-bold tw-rounded-full tw-h-11 tw-w-11 tw-justify-center tw-items-center ${getPlayerColors(user?.slot)} ${getBorder(user?.slot)}`}>
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
