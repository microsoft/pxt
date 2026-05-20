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
    index: number;
    selectReference: (el: HTMLDivElement) => void;
    playReference: (el: HTMLButtonElement) => void;
    activeDescendant: string;
    gridFocused: boolean;
    getCellId: (col: "select" | "preview", row: number) => string;
    onPreviewButtonClick: (index: number, keyboardTriggered: boolean) => void;
}


export const SoundGallery = (props: SoundGalleryProps) => {
    const { sounds, onSoundSelected, visible, useMixerSynthesizer } = props;

    const selectItemRefs = React.useRef<HTMLDivElement[]>([]);
    const playItemRefs = React.useRef<HTMLButtonElement[]>([]);
    const selectedCoord = React.useRef<{row: number, col: "select" | "preview"}>({row: 0, col: "select"});
    const [activeDescendant, setActiveDescendant] = React.useState<string>("sound-gallery-cell-select-0");
    const [gridFocused, setGridFocused] = React.useState(false);

    const getCellId = (col: "select" | "preview", row: number) => `sound-gallery-cell-${col}-${row}`;

    const updateActiveDescendant = (col: "select" | "preview", row: number) => {
        selectedCoord.current = { col, row };
        const id = getCellId(col, row);
        setActiveDescendant(id);
        document.getElementById(id)?.scrollIntoView({ block: "nearest" });
    };

    const focusSelectOrPlayElement = React.useCallback((e: React.KeyboardEvent<HTMLElement> | React.FocusEvent) => {
        if (e.type === "focus") {
            const playIndex = playItemRefs.current.indexOf(e.target as HTMLButtonElement);
            if (playIndex !== -1) {
                updateActiveDescendant("preview", playIndex);
                return;
            }

            const selectIndex = selectItemRefs.current.indexOf(e.target as HTMLDivElement);
            if (selectIndex !== -1) {
                updateActiveDescendant("select", selectIndex);
                return;
            }
        }

        updateActiveDescendant(selectedCoord.current.col, selectedCoord.current.row);
        e.preventDefault();
    }, []);

    const handleKeyDown = (
        e: React.KeyboardEvent<HTMLElement>) => {
        const { row, col } = selectedCoord.current;
        const prev = Math.max(row - 1, 0);
        const next = Math.min(row + 1, sounds.length - 1);
        const arrowToSelection = pxt.Util.isUserLanguageRtl() ? "ArrowRight" : "ArrowLeft";
        const arrowToPreview = pxt.Util.isUserLanguageRtl() ? "ArrowLeft" : "ArrowRight";
        switch(e.code) {
            case "ArrowDown":
                updateActiveDescendant(col, next);
                break;
            case "ArrowUp":
                updateActiveDescendant(col, prev);
                break;
            case arrowToSelection:
                updateActiveDescendant("select", row);
                break;
            case arrowToPreview:
                updateActiveDescendant("preview", row);
                break;
            case "Space":
            case "Enter":
                if (col === "select") {
                    onSoundSelected(sounds[row].sound);
                    e.stopPropagation();
                } else {
                    playItemRefs.current[row]?.click();
                }
                e.preventDefault();
                return;
            case "Home":
                updateActiveDescendant("select", 0);
                break;
            case "End":
                updateActiveDescendant("preview", sounds.length - 1);
                break;
            default:
                return;
        }
        e.preventDefault();
        setGridFocused(true);
    };

    const ref = React.useRef<HTMLDivElement>(null);

    const handlePreviewButtonClick = (index: number, keyboardTriggered: boolean) => {
        ref.current?.focus({ preventScroll: true });
        updateActiveDescendant("preview", index);
        setGridFocused(keyboardTriggered);
    }

    return <div className={classList("sound-gallery", visible && "visible")} aria-hidden={!visible}>
        <div
            ref={ref}
            className="sound-gallery-scroller"
            tabIndex={0}
            role="grid"
            aria-activedescendant={activeDescendant}
            onFocus={e => { setGridFocused(true); focusSelectOrPlayElement(e); }}
            onBlur={() => setGridFocused(false)}
            onKeyDown={e => handleKeyDown(e)}>
            {sounds.map((item, index) => {
                return (
                    <div
                        key={index}
                        onClick={() => onSoundSelected(item.sound)}
                        className="common-button">
                        <SoundGalleryEntry
                            {...item}
                            useMixerSynthesizer={useMixerSynthesizer}
                            index={index}
                            selectReference={ref => selectItemRefs.current[index] = ref}
                            playReference={ref => playItemRefs.current[index] = ref}
                            activeDescendant={activeDescendant}
                            gridFocused={gridFocused}
                            onPreviewButtonClick={handlePreviewButtonClick}
                            getCellId={getCellId}
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
        index,
        playReference,
        onPreviewButtonClick,
        selectReference,
        activeDescendant,
        gridFocused,
        getCellId,
    } = props;
    const width = 160;
    const height = 40;

    const [ cancelToken, setCancelToken ] = React.useState<CancellationToken>(null);

    const selectId = getCellId("select", index);
    const previewId = getCellId("preview", index);
    const selectActive = gridFocused && activeDescendant === selectId;
    const previewActive = gridFocused && activeDescendant === previewId;

    const handlePlayButtonClick = async (e: React.MouseEvent) => {
        const keyboardTriggered = e.detail === 0;
        onPreviewButtonClick(index, keyboardTriggered);
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
            await pxsim.codal.music.playSoundExpressionAsync(soundToCodalSound(sound).src);
        }

        setCancelToken(null);
    }

    return <div className="sound-gallery-item-label" role="row" id={`sound-gallery-row-${index}`}>
        <div
            id={selectId}
            className="sound-gallery-item-label-inner"
            ref={selectReference}
            role="gridcell"
            aria-selected={selectActive}>
            <div className="sr-only">
                {lf("Select {0} Sound", name)}
            </div>
            <div className="sound-effect-name" aria-hidden="true">
                {name}
            </div>
            <div className="sound-gallery-preview" aria-hidden="true">
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
            id={previewId}
            className="sound-effect-play-button"
            buttonRef={playReference}
            tabIndex={-1}
            onClick={null}
            onClickEvent={e => handlePlayButtonClick(e)}
            // Don't allow focus to be stolen.
            onMouseDown={(e) => e.preventDefault()}
            leftIcon={cancelToken ? "fas fa-stop" : "fas fa-play"}
            role="gridcell"
            ariaSelected={previewActive}
            title={null}
        >
            <span className="sr-only">{lf("Preview {0} Sound", name)}</span>
        </Button>
    </div>
}
