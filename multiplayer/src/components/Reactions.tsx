import { ReactionDb } from "../types/reactions";
import { sendReactionAsync } from "../epics";
import { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faFaceSmile } from "@fortawesome/free-regular-svg-icons";

export default function Render() {
    const [ showReactionPicker, setShowReactionPicker ]= useState(false);

    const onReactionClick = async (index: number) => {
        await sendReactionAsync(index);
    };

    // const smileIcon = {...faFaceSmile, prefix: "fal"};
    return (
        <div>
            {/* Separate component for reaction picker? */}
            { showReactionPicker &&
                <div className="tw-flex tw-flex-row tw-gap-1 tw-p-2 tw-absolute tw-translate-x-[-5.8rem] tw-translate-y-[-120%] tw-bg-white tw-shadow-md">
                    {ReactionDb.map((def, i) => {
                        return (
                            <div
                                className="tw-flex tw-items-center tw-justify-center tw-cursor-pointer tw-select-none tw-border tw-rounded-full tw-border-slate-300 tw-bg-neutral-50 hover:tw-scale-125 tw-ease-linear tw-duration-[50ms] active:tw-bg-neutral-200 tw-h-8 tw-w-8 tw-text-2xl"
                                key={i}
                                onClick={() => onReactionClick(i)}>
                                {def.emoji}
                            </div>
                        );
                    })}
                </div>
            }
            <button id="reactionsButton" aria-label={lf("reactions")} className={`tw-flex tw-border-0 tw-rounded-full tw-h-11 tw-w-11 tw-items-center tw-justify-center tw-text-[2rem] tw-cursor-pointer hover:tw-scale-110 tw-ease-linear tw-duration-[50ms]`}
                onClick={() => setShowReactionPicker(!showReactionPicker)}>
                <span role="img" aria-labelledby="reactionsButton">🙂</span>
            </button>
        </div>
    );
}
