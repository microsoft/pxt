import { useCallback, useContext, useMemo, useState, useRef } from "react"
import { AppStateContext } from "../state/AppStateContext"
import * as util from "../util"
import ReactionEmitter from "./ReactionEmitter"

export default function Render() {
    const { state } = useContext(AppStateContext)
    const { presence } = state

    const slotRef = useRef<(HTMLDivElement | null)[]>([])

    const players = useMemo(() => {
        return presence.users.filter(user => user.slot < 5)
    }, [presence])

    const spectators = useMemo(() => {
        return presence.users.filter(user => user.slot >= 5)
    }, [presence])

    return (
        <div>
            <div className="text-lg font-bold">{lf("Players")}</div>
            <div className="flex flex-row items-center justify-center gap-2 mt-2">
                {[1, 2, 3, 4].map(slot => {
                    const user = players.find(u => u.slot === slot)
                    return (
                        <div
                            key={slot}
                            ref={ref => (slotRef.current[slot] = ref)}
                            className="flex p-1 border border-slate-300 rounded-full min-h-[2.25rem] min-w-[2.25rem] bg-neutral-50"
                        >
                            {user?.name}
                            {user && (
                                <ReactionEmitter
                                    userId={user.id}
                                    parentRef={slotRef.current[slot]!}
                                />
                            )}
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
