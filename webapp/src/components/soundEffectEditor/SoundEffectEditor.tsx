import * as React from "react";
import { Button } from "../../../../react-common/components/controls/Button";
import { SoundControls } from "./SoundControls";
import { SoundEffectHeader } from "./SoundEffectHeader";
import { SoundGallery } from "./SoundGallery";
import { SoundPreview } from "./SoundPreview";
import { getGallerySounds, soundToCodalSound } from "./soundUtil";
import { FocusTrap, FocusTrapRegion } from "../../../../react-common/components/controls/FocusTrap";

export interface SoundEffectEditorProps {
    onSoundChange?: (newValue: pxt.assets.Sound) => void;
    onClose?: () => void;
    initialSound: pxt.assets.Sound;

    // If true, uses the mixer synth (from pxt-common-packages). If false, uses codal synth
    useMixerSynthesizer?: boolean;
    keyboardTriggered: boolean;
}

export interface CancellationToken {
    cancelled: boolean;
}

export const SoundEffectEditor = (props: SoundEffectEditorProps) => {
    const { onSoundChange, onClose, initialSound, useMixerSynthesizer, keyboardTriggered } = props;

    const [ selectedView, setSelectedView ] = React.useState<"editor" | "gallery">("editor");

    const [ sound, setSound ] = React.useState<pxt.assets.Sound>(initialSound);

    // When using the "Generate Similar Sound" button, we keep the original sound around so
    // that we never stray too far away from where we started
    const [ similarSoundSeed, setSimilarSoundSeed ] = React.useState<pxt.assets.Sound>(undefined);

    const [ cancelToken, setCancelToken ] = React.useState<CancellationToken>(null);

    const playButtonRef = React.useRef<HTMLElement>();

    React.useEffect(() => {
        if (keyboardTriggered) {
            document.getElementById("sound-effect-editor-toggle-option-0").focus();
        }
    }, []);

    let startPreviewAnimation: (duration: number) => void;
    let startControlsAnimation: (duration: number) => void;
    let previewSynthListener: (freq: number, vol: number, sound: pxt.assets.Sound, cancelToken: CancellationToken) => void;

    const cancel = () => {
        if (!cancelToken) return;
        cancelToken.cancelled = true;
        if (startPreviewAnimation) startPreviewAnimation(-1);
        if (startControlsAnimation) startControlsAnimation(-1);
    }


    const play = React.useCallback(async (toPlay = sound) => {
        cancel();

        let newToken = {
            cancelled: false
        };

        setCancelToken(newToken)

        if (startPreviewAnimation) startPreviewAnimation(toPlay.duration);
        if (startControlsAnimation) startControlsAnimation(toPlay.duration);

        const isCancelled = () => newToken.cancelled;
        const onPull = (freq: number, volume: number) => {
            previewSynthListener(freq, volume, toPlay, newToken)
        }

        if (useMixerSynthesizer) {
            await pxsim.AudioContextManager.playInstructionsAsync(pxt.assets.soundToInstructionBuffer(toPlay, 20, 1), isCancelled, onPull);
        }
        else {
            await pxsim.codal.music.playSoundExpressionAsync(soundToCodalSound(toPlay).src, 127, isCancelled, onPull);
        }

        setCancelToken(null);
    }, [sound]);

    const handleKeyDown = React.useCallback((ev: React.KeyboardEvent) => {
            // Ignore all keys that could be used for accessibility navigation
            // Enter is exempt to maintain the same behaviour with Space (" ")
            if ((ev.key.length !== 1 && ev.key !== "Enter") || ev.metaKey || ev.ctrlKey || /[0-9]/.test(ev.key)) return;

            // Ignore when a text input is focused
            if (document.activeElement) {
                if (
                    document.activeElement.tagName === "INPUT" &&
                    (document.activeElement as HTMLInputElement).type === "text"
                )
                    return;
                // Space and Enter shouldn't fire these as these keys open dropdowns
                if (
                      (document.activeElement.id === "effect-dropdown" ||
                     document.activeElement.id === "interpolation-dropdown") &&
                     (ev.key === " " || ev.key === "Enter")
                )
                    return;
                if (document.activeElement.id === "sound-effect-play-button")
                    return;
            }
            // Ignore in gallery view
            if (selectedView === "gallery") return;

            play();
    }, [play, selectedView])

    const handlePlayButtonClick = () => {
        if (cancelToken) {
            cancel();
        }
        else {
            play();
        }
    }

    const handleClose = () => {
        if (onClose) onClose();
    }

    const onViewSelected = (view: "editor" | "gallery") => {
        setSelectedView(view);
    }

    const handlePreviewAnimationRef = (startAnimation: (duration: number) => void) => {
        startPreviewAnimation = startAnimation;
    }

    const handleControlsAnimationRef = (startAnimation: (duration: number) => void) => {
        startControlsAnimation = startAnimation;
    }

    const handleSynthListenerRef = (onPull: (freq: number, vol: number, sound: pxt.assets.Sound, token: CancellationToken) => void) => {
        previewSynthListener = onPull;
    }

    const handleSoundChange = (newSound: pxt.assets.Sound, setSoundSeed = true) => {
        if (cancelToken) cancel();
        if (setSoundSeed) setSimilarSoundSeed(undefined);
        if (onSoundChange) onSoundChange(newSound);
        setSound(newSound);
    }

    const handleGallerySelection = (newSound: pxt.assets.Sound) => {
        handleSoundChange(newSound);
        setSelectedView("editor");
        playButtonRef.current.focus();
    }

    return (
        <div className="sound-effect-editor" onKeyDown={handleKeyDown}>
            {/* 
                Don't steal focus to prevent focus-visible style if opened by mouse.
                If opened by keyboard, we focus the editor / gallery toggle anyway.
            */}
            <FocusTrap onEscape={handleClose} dontStealFocus>
                <SoundEffectHeader
                    selectedView={selectedView}
                    onViewSelected={onViewSelected}
                    onClose={handleClose}
                />
                <div className="sound-effect-editor-content">
                    <FocusTrapRegion enabled={selectedView === "editor"}>
                        <SoundPreview
                            sound={sound}
                            handleStartAnimationRef={handlePreviewAnimationRef}
                            handleSynthListenerRef={handleSynthListenerRef} />
                        <Button
                            id="sound-effect-play-button"
                            buttonRef={ref => playButtonRef.current = ref}
                            className="sound-effect-play-button"
                            title={cancelToken ? lf("Stop") : lf("Play")}
                            onClick={handlePlayButtonClick}
                            leftIcon={cancelToken ? "fas fa-stop" : "fas fa-play"}
                            />
                        <SoundControls sound={sound} onSoundChange={handleSoundChange} handleStartAnimationRef={handleControlsAnimationRef} />
                        <Button
                            className="link-button generate-similar"
                            leftIcon="fas fa-sync"
                            label={pxt.U.lf("Generate Similar Sound")}
                            title={pxt.U.lf("Generate Similar Sound")}
                            onClick={() => {
                                let newSound: pxt.assets.Sound;
                                if (!similarSoundSeed) {
                                    setSimilarSoundSeed(sound);
                                    newSound = generateSimilarSound(sound);
                                }
                                else {
                                    newSound = generateSimilarSound(similarSoundSeed);
                                }
                                handleSoundChange(newSound, false);
                                play(newSound);
                            }}
                        />
                    </FocusTrapRegion>

                    <FocusTrapRegion enabled={selectedView === "gallery"}>
                        <SoundGallery
                            sounds={getGallerySounds(useMixerSynthesizer)}
                            onSoundSelected={handleGallerySelection}
                            visible={selectedView === "gallery"}
                            useMixerSynthesizer={useMixerSynthesizer}
                            />
                    </FocusTrapRegion>
                </div>
            </FocusTrap>
        </div>
    )
}

function generateSimilarSound(sound: pxt.assets.Sound) {
    const res = {
        ...sound
    };

    res.interpolation = pickRandom("linear", "curve", "logarithmic")

    res.duration = clamp(
        res.duration + (Math.random() - 0.5) * res.duration,
        Math.min(100, res.duration),
        Math.max(2000, res.duration)
    );


    if (res.wave === "noise") {
        // The primary waveforms don't produce sounds that are similar to noise,
        // but adding an effect sorta does
        if (percentChance(20)) {
            res.wave = pickRandom("sine", "sawtooth", "square", "triangle");
            res.effect = pickRandom("vibrato", "tremolo", "warble");
        }
    }
    else {
        res.wave = pickRandom("sine", "sawtooth", "square", "triangle");

        // Adding an effect can drastically alter the sound, so keep it
        // at a low percent chance unless there already is one
        if (res.effect !== "none" || percentChance(10)) {
            res.effect = pickRandom("vibrato", "tremolo", "warble");
        }
    }

    // Instead of randomly changing the frequency, change the slope and choose
    // a new start frequency. This keeps a similar profile to the sound
    const oldFrequencyDifference = res.endFrequency - res.startFrequency;
    let newFrequencyDifference = oldFrequencyDifference + (oldFrequencyDifference * 2) * (Math.random() - 0.5);

    if (Math.sign(oldFrequencyDifference) !== Math.sign(newFrequencyDifference)) {
        newFrequencyDifference *= -1;
    }

    newFrequencyDifference = clamp(newFrequencyDifference, -pxt.assets.MAX_FREQUENCY, pxt.assets.MAX_FREQUENCY);

    res.startFrequency = clamp(
        Math.random() * pxt.assets.MAX_FREQUENCY,
        Math.max(-newFrequencyDifference, 1),
        clamp(5000 - newFrequencyDifference, 1, pxt.assets.MAX_FREQUENCY)
    );

    res.endFrequency = clamp(res.startFrequency + newFrequencyDifference, 1, pxt.assets.MAX_FREQUENCY);

    // Same strategy for volume
    const oldVolumeDifference = res.endVolume - res.startVolume;
    let newVolumeDifference = oldVolumeDifference + oldVolumeDifference * (Math.random() - 0.5);

    newVolumeDifference = clamp(newVolumeDifference, -pxt.assets.MAX_VOLUME, pxt.assets.MAX_VOLUME);

    if (Math.sign(oldVolumeDifference) !== Math.sign(newVolumeDifference)) {
        newVolumeDifference *= -1;
    }

    res.startVolume = clamp(
        Math.random() * pxt.assets.MAX_VOLUME,
        Math.max(-newVolumeDifference, 0),
        clamp(pxt.assets.MAX_VOLUME - newVolumeDifference, 0, pxt.assets.MAX_VOLUME)
    );

    res.endVolume = clamp(res.startVolume + newVolumeDifference, 0, pxt.assets.MAX_VOLUME);

    return res;
}

function pickRandom<U extends string>(...choices: U[]) {
    return choices[Math.floor(Math.random() * choices.length)]
}

function percentChance(percent: number) {
    return Math.random() * 100 < percent;
}

function clamp(value: number, min: number, max: number) {
    return Math.floor(Math.min(max, Math.max(min, value)))
}