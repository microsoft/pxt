import { Reactions } from "../types/reactions";
import { sendReactionAsync } from "../epics";
import { useState } from "react";
import ReactionsIcon from "./icons/ReactionsIcon";
import { Button } from "react-common/components/controls/Button";
import Popup from "./Popup";

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
            <Popup
                className={"tw-absolute tw-translate-y-[-120%]"}
                visible={showReactionPicker}
                onClickedOutside={() => setShowReactionPicker(false)}
            >
                <div
                    className={`tw-flex tw-flex-row tw-gap-3 tw-p-2
                    tw-bg-white tw-drop-shadow-xl tw-rounded-md`}
                >
                    {Reactions.map((def, i) => {
                        return (
                            <Button
                                className="tw-flex tw-items-center tw-justify-center tw-m-0 tw-p-0 tw-cursor-pointer tw-select-none tw-scale-110 hover:tw-scale-125 tw-ease-linear tw-duration-[50ms] tw-h-8 tw-w-8 tw-text-2xl"
                                key={i}
                                label={def.emoji}
                                title={def.name}
                                onClick={() => onReactionClick(i)}
                            />
                        );
                    })}
                </div>
            </Popup>
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
