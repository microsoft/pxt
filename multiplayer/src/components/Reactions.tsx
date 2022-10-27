import { Reactions } from "../types/reactions";
import { sendReactionAsync } from "../epics";
import { useState } from "react";
import ReactionsIcon from "./icons/ReactionsIcon";
import { Button } from "react-common/components/controls/Button";

// fill="#4D4D4D"

export default function Render() {
    const [showReactionPicker, setShowReactionPicker] = useState(false);

    const onReactionClick = async (index: number) => {
        await sendReactionAsync(index);
    };

    const buttonLabel = () => (
        <ReactionsIcon className="hover:tw-scale-125 tw-ease-linear tw-duration-[50ms]" />
    );

    return (
        <div>
            {showReactionPicker && (
                <div
                    className={`tw-flex tw-flex-row tw-gap-1 tw-p-2 tw-absolute tw-translate-x-[-5.8rem]
                    tw-translate-y-[-120%] tw-bg-white tw-drop-shadow-md tw-rounded-md`}
                >
                    {Reactions.map((def, i) => {
                        return (
                            <div
                                className="tw-flex tw-items-center tw-justify-center tw-cursor-pointer tw-select-none tw-border tw-rounded-full tw-border-slate-300 tw-bg-neutral-50 hover:tw-scale-125 tw-ease-linear tw-duration-[50ms] active:tw-bg-neutral-200 tw-h-8 tw-w-8 tw-text-2xl"
                                key={i}
                                onClick={() => onReactionClick(i)}
                            >
                                {def.emoji}
                            </div>
                        );
                    })}
                </div>
            )}
            <Button
                label={buttonLabel()}
                title={lf("Reactions")}
                className={`tw-flex tw-items-center tw-justify-center
                tw-select-none tw-border-2 tw-text-slot-0-color
                tw-rounded-full tw-h-11 tw-w-11 tw-text-2xl !tw-m-0 !tw-p-0`}
                style={{
                    backgroundColor: `rgba(var(--slot-0-color),0.1)`,
                }}
                onClick={() => setShowReactionPicker(!showReactionPicker)}
            />
        </div>
    );
}
