import { Reactions } from "../types/reactions";
import { sendReactionAsync } from "../epics";
import { useCallback, useContext, useEffect, useRef, useState } from "react";
import ReactionsIcon from "./icons/ReactionsIcon";
import { Button } from "react-common/components/controls/Button";
import Popup from "./Popup";
import { AppStateContext } from "../state/AppStateContext";

export default function Render() {
    const { state } = useContext(AppStateContext);
    const [showReactionPicker, setShowReactionPicker] = useState(false);
    const reactionButtonsRef = useRef<Element | null>(null);
    const setReactionsButtonRef = useCallback((el: Element | null) => {
        reactionButtonsRef.current = el;
    }, []);
    const { gameState } = state;
    const reactionIconOverrides = gameState?.reactionIconOverrides;

    const onReactionClick = async (index: number) => {
        await sendReactionAsync(index);
    };

    const onReactionsButtonRef = (ref: HTMLButtonElement) => {
        setReactionsButtonRef(ref);
    };

    const buttonLabel = () => <ReactionsIcon className="hover:tw-scale-125 tw-ease-linear tw-duration-[50ms]" />;

    useEffect(() => {
        const simButtonEvent = (e: MessageEvent) => {
            if (e.data.type === "messagepacket" && e.data.channel) {
                const numberKey = /keydown-(\d)/i.exec(e.data.channel)?.[1];
                if (!numberKey) return;
                const ind = parseInt(numberKey) - 1;
                if (Reactions[ind]) {
                    sendReactionAsync(ind);
                }
            }
        };
        const outsideSimKeyEvent = (e: KeyboardEvent) => {
            const ind = parseInt(e.key) - 1;
            if (Reactions[ind]) {
                sendReactionAsync(ind);
            }
        };

        window.addEventListener("message", simButtonEvent);
        window.addEventListener("keydown", outsideSimKeyEvent);
        return () => {
            window.removeEventListener("message", simButtonEvent);
            window.removeEventListener("keydown", outsideSimKeyEvent);
        };
    });

    const isMobile = pxt.BrowserUtils.isMobile() || pxt.BrowserUtils.isIOS();

    return (
        <div>
            <Popup
                className="tw-absolute tw-translate-y-[-120%]"
                visible={showReactionPicker}
                ignoreRefs={[reactionButtonsRef]}
                onClickedOutside={() => setShowReactionPicker(false)}
            >
                <div className="tw-flex tw-flex-col tw-bg-white tw-drop-shadow-xl tw-rounded-md tw-border-2 tw-border-gray-100">
                    <div className="tw-flex tw-flex-row tw-gap-3 tw-p-2 tw-pb-3 tw-pr-3">
                        {Reactions.map((def, i) => {
                            const override = reactionIconOverrides?.[i + 1];
                            const display = override ? (
                                <img
                                    className="pixel-art-image tw-w-6"
                                    src={override}
                                    alt={lf("Game reaction image {0}", i + 1)}
                                />
                            ) : (
                                def.emoji
                            );
                            return (
                                <Button
                                    className="tw-flex tw-items-center tw-justify-center tw-m-0 tw-p-0 tw-cursor-pointer tw-select-none tw-scale-110 hover:tw-scale-125 tw-ease-linear tw-duration-[50ms] tw-h-8 tw-w-8 tw-text-2xl"
                                    key={i + 1}
                                    label={
                                        <div>
                                            <div>{display}</div>
                                            {!isMobile && (
                                                <div className="tw-text-xs tw-absolute tw-bottom-[-5px] tw-right-[-5px] tw-text-white tw-bg-gray-400 tw-rounded-sm tw-border-[1px] tw-border-solid tw-border-gray-500 tw-drop-shadow-lg tw-px-1 tw-leading-tight">
                                                    {i + 1}
                                                </div>
                                            )}
                                        </div>
                                    }
                                    title={def.name}
                                    onClick={() => onReactionClick(i)}
                                />
                            );
                        })}
                    </div>
                </div>
            </Popup>
            <Button
                label={buttonLabel()}
                title={lf("Reactions")}
                className={`tw-flex tw-items-center tw-justify-center
                tw-select-none tw-border-2 tw-reaction-color
                tw-rounded-full tw-h-11 tw-w-11 tw-text-2xl !tw-m-0 !tw-p-0`}
                style={{
                    backgroundColor: `rgba(var(--reaction-color),0.1)`,
                }}
                onClick={() => {
                    const toggled = !showReactionPicker;
                    if (toggled) {
                        pxt.tickEvent("mp.reactions.open");
                    }
                    setShowReactionPicker(toggled);
                }}
                buttonRef={onReactionsButtonRef}
            />
        </div>
    );
}
