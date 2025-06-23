import * as React from "react";
import { Button } from "../../../../react-common/components/controls/Button";
import { classList } from "../../../../react-common/components/util";
import { CancellationToken } from "./SoundEffectEditor";
import { soundToCodalSound } from "./soundUtil";

export interface SoundGalleryItem {
    sound: pxt.assets.Sound;
    name: string;
}

export interface SoundGalleryProps {
    onSoundSelected: (newSound: pxt.assets.Sound) => void;
    sounds: SoundGalleryItem[];
    visible: boolean;
    useMixerSynthesizer: boolean;
}

interface SoundGalleryItemProps extends SoundGalleryItem {
    useMixerSynthesizer: boolean;
    selectReference: (el: HTMLDivElement) => void;
    playReference: (el: HTMLButtonElement) => void;
    previewKeyDown: (evt: React.KeyboardEvent<HTMLElement>) => void;
    selectKeyDown: (evt: React.KeyboardEvent<HTMLElement>) => void;
}


export const SoundGallery = (props: SoundGalleryProps) => {
    const { sounds, onSoundSelected, visible, useMixerSynthesizer } = props;

    const selectItemRefs = React.useRef<HTMLDivElement[]>([]);
    const playItemRefs = React.useRef<HTMLButtonElement[]>([]);
    const selectedCoord = React.useRef<{row: number, col: "select" | "preview"}>({row: 0, col: "select"});

    const focusSelectOrPlayElement = React.useCallback((e: React.KeyboardEvent<HTMLElement> | React.FocusEvent) => {
        if (e.type === "focus") {
            // Check to see if this focus event is coming from a click on a child element
            const playIndex = playItemRefs.current.indexOf(e.target as HTMLButtonElement);
            if (playIndex !== -1) {
                selectedCoord.current = {col: "preview", row: playIndex};
                return;
            }

            const selectIndex = selectItemRefs.current.indexOf(e.target as HTMLDivElement);
            if (selectIndex !== -1) {
                selectedCoord.current = {col: "select", row: selectIndex};
                return;
            }
        }

        const elements = (selectedCoord.current.col === "select" ? selectItemRefs : playItemRefs).current;
        elements[selectedCoord.current.row].focus();
        e.preventDefault();
    }, []);

    const handleKeyDown = (
        prev: number,
        next: number,
        current: number,
        e: React.KeyboardEvent<HTMLElement>) => {
        const arrowToSelection = pxt.Util.isUserLanguageRtl() ? "ArrowRight" : "ArrowLeft";
        const arrowToPreview = pxt.Util.isUserLanguageRtl() ? "ArrowLeft" : "ArrowRight";
        switch(e.code) {
            case "ArrowDown":
                selectedCoord.current.row = next;
                break;
            case "ArrowUp":
                selectedCoord.current.row = prev;
                break;
            case arrowToSelection:
                selectedCoord.current.col = "select";
                break;
            case arrowToPreview:
                selectedCoord.current.col = "preview";
                break;
            case "Space":
            case "Enter":
                if (selectedCoord.current.col === "select") {
                    onSoundSelected(sounds[current].sound)
                    e.stopPropagation();
                    e.preventDefault();
                }
                return;
            case "Home":
                selectedCoord.current = {col: "select", row: 0};
                break;
            case "End":
                selectedCoord.current = {col: "preview", row: sounds.length - 1};
                break;
            default: {
                return;
            }
        }
        focusSelectOrPlayElement(e);
    }

    return <div className={classList("sound-gallery", visible && "visible")} aria-hidden={!visible}>
        <div className="sound-gallery-scroller"
            tabIndex={0}
            onFocus={focusSelectOrPlayElement}>
            {sounds.map((item, index) => {
                    const prev = Math.max(index - 1, 0);
                    const next = Math.min(index + 1, sounds.length - 1);
                    return(<div
                        key={index}
                        onClick={() => onSoundSelected(item.sound)}
                        className="common-button">

                        <SoundGalleryEntry
                            {...item}
                            useMixerSynthesizer={useMixerSynthesizer}

                            selectReference={ref => selectItemRefs.current[index] = ref}
                            playReference={ref => playItemRefs.current[index] = ref}

                            previewKeyDown={evt => handleKeyDown(prev, next, index, evt)}
                            selectKeyDown={evt => handleKeyDown(prev, next, index, evt)}
                        />
                    </div>);
                })
            }
        </div>
    </div>
}

const SoundGalleryEntry = (props: SoundGalleryItemProps) => {
    const {
        sound,
        name,
        useMixerSynthesizer,
        playReference,
        selectReference,
        previewKeyDown,
        selectKeyDown
    } = props;
    const width = 160;
    const height = 40;

    const [ cancelToken, setCancelToken ] = React.useState<CancellationToken>(null);

    const handlePlayButtonClick = async () => {
        if (cancelToken) {
            cancelToken.cancelled = true
            setCancelToken(null);
            return;
        }
        const newToken = {
            cancelled: false
        }
        setCancelToken(newToken);

        if (useMixerSynthesizer) {
            await pxsim.AudioContextManager.playInstructionsAsync(pxt.assets.soundToInstructionBuffer(sound, 20, 1));
        }
        else {
            await pxsim.codal.music.playSoundExpressionAsync(soundToCodalSound(sound).src, undefined, undefined, 0.03);
        }

        setCancelToken(null);
    }

    return <div className="sound-gallery-item-label">
        <div className="sound-gallery-item-label-inner"
            tabIndex={-1}
            ref={selectReference}
            onKeyDown={selectKeyDown}
            title={name}
            role="button">
            <div className="sound-effect-name">
                {name}
            </div>
            <div className="sound-gallery-preview">
                <svg viewBox={`0 0 ${width} ${height}`} xmlns="http://www.w3.org/2000/svg">
                    <path
                        className="sound-gallery-preview-wave"
                        d={pxt.assets.renderSoundPath(sound, width, height)}
                        strokeWidth="2"
                        fill="none"/>
                </svg>
            </div>
        </div>
        <Button
            className="sound-effect-play-button"
            buttonRef={playReference}
            tabIndex={-1}
            title={cancelToken ? lf("Stop Sound Preview") : lf("Preview Sound")}
            onClick={handlePlayButtonClick}
            onKeydown={previewKeyDown}
            leftIcon={cancelToken ? "fas fa-stop" : "fas fa-play"}
            />
    </div>
}


