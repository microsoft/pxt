import { ReactionDb } from "../types/reactions"
import { sendReactionAsync } from "../epics"

export default function Render() {
    const onReactionClick = async (index: number) => {
        await sendReactionAsync(index)
    }

    return (
        <div>
            <div className="text-lg font-bold">{lf("Reactions")}</div>
            <div className="flex flex-row gap-1 mt-1">
                {ReactionDb.map((def, i) => {
                    return (
                        <div
                            className="cursor-pointer select-none border rounded-full border-slate-300 bg-neutral-50 hover:scale-150 ease-linear duration-[50ms] active:bg-neutral-200"
                            key={i}
                            onClick={() => onReactionClick(i)}
                        >
                            {def.emoji}
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
