import { ReactionDb } from "../types/reactions";
import { sendReactionAsync } from "../epics";

export default function Render() {
    const onReactionClick = async (index: number) => {
        await sendReactionAsync(index);
    };

    return (
        <div>
            <div className="tw-text-lg tw-font-bold">{lf("Reactions")}</div>
            <div className="tw-flex tw-flex-row tw-gap-1 tw-mt-1">
                {ReactionDb.map((def, i) => {
                    return (
                        <div
                            className="tw-cursor-pointer tw-select-none tw-border tw-rounded-full tw-border-slate-300 tw-bg-neutral-50 hover:tw-scale-150 tw-ease-linear tw-duration-[50ms] active:tw-bg-neutral-200"
                            key={i}
                            onClick={() => onReactionClick(i)}
                        >
                            {def.emoji}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
