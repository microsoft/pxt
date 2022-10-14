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
                <div className="tw-flex tw-flex-row tw-gap-1 tw-p-1 tw-absolute tw-translate-x-[-2rem] tw-translate-y-[-120%] tw-bg-white tw-shadow-md">
                    {ReactionDb.map((def, i) => {
                        return (
                            <div
                                className="tw-cursor-pointer tw-select-none tw-border tw-rounded-full tw-border-slate-300 tw-bg-neutral-50 hover:tw-scale-150 tw-ease-linear tw-duration-[50ms] active:tw-bg-neutral-200"
                                key={i}
                                onClick={() => onReactionClick(i)}>
                                {def.emoji}
                            </div>
                        );
                    })}
                </div>
            }
            <div className={`tw-flex tw-border-0 tw-text-black tw-rounded-full tw-h-11 tw-w-11 tw-items-center tw-justify-center tw-text-[2rem] tw-bg-neutral-300 tw-cursor-pointer`}
                onClick={() => setShowReactionPicker(!showReactionPicker)}>
                {/* {<FontAwesomeIcon icon={faFaceSmile} className="tw-w-8 tw-h-8"/>} */}
                🙂
            </div>
        </div>
    );
}
