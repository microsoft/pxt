import * as React from "react";
import { Button } from "../../../../react-common/components/controls/Button";
import { SoundControls } from "./SoundControls";
import { SoundEffectHeader } from "./SoundEffectHeader";
import { SoundGallery } from "./SoundGallery";
import { SoundPreview } from "./SoundPreview";
import { getGallerySounds, soundToCodalSound } from "./soundUtil";

export interface SoundEffectEditorProps {
    onSoundChange?: (newValue: pxt.assets.Sound) => void;
    onClose?: () => void;
    initialSound: pxt.assets.Sound;
}

export const SoundEffectEditor = (props: SoundEffectEditorProps) => {
    const { onSoundChange, onClose, initialSound } = props;

    const [ selectedView, setSelectedView ] = React.useState<"editor" | "gallery">("editor");

    const [ sound, setSound ] = React.useState<pxt.assets.Sound>(initialSound);

    // When using the "Generate Similar Sound" button, we keep the original sound around so
    // that we never stray too far away from where we started
    const [ similarSoundSeed, setSimilarSoundSeed ] = React.useState<pxt.assets.Sound>(undefined);

    let startPreviewAnimation: (duration: number) => void;
    let startControlsAnimation: (duration: number) => void;
    let cancelSound: () => void;
    let previewSynthListener: (freq: number, vol: number, sound: pxt.assets.Sound) => void;

    const play = (toPlay = sound) => {
        const codalSound = soundToCodalSound(toPlay);

        if (cancelSound) cancelSound();
        let cancelled = false;
        cancelSound = () => {
            cancelled = true;
            if (startPreviewAnimation) startPreviewAnimation(-1);
            if (startControlsAnimation) startControlsAnimation(-1);
        }

        if (startPreviewAnimation) startPreviewAnimation(toPlay.duration);
        if (startControlsAnimation) startControlsAnimation(toPlay.duration);
        pxsim.codal.music.playSoundExpressionAsync(codalSound.src, () => cancelled, (freq, volume) => {
            previewSynthListener(freq, volume, toPlay)
        });
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

    const handleSynthListenerRef = (onPull: (freq: number, vol: number, sound: pxt.assets.Sound) => void) => {
        previewSynthListener = onPull;
    }

    const handleSoundChange = (newSound: pxt.assets.Sound, setSoundSeed = true) => {
        if (cancelSound) cancelSound();
        if (setSoundSeed) setSimilarSoundSeed(undefined);
        if (onSoundChange) onSoundChange(newSound);
        setSound(newSound);
    }

    const handleGallerySelection = (newSound: pxt.assets.Sound) => {
        handleSoundChange(newSound)
        setSelectedView("editor");
    }

    return <div className="sound-effect-editor">
        <SoundEffectHeader
            selectedView={selectedView}
            onViewSelected={onViewSelected}
            onClose={handleClose}
        />
        <div className="sound-effect-editor-content">
            <SoundPreview sound={sound} handleStartAnimationRef={handlePreviewAnimationRef} handleSynthListenerRef={handleSynthListenerRef} />
            <Button
                className="sound-effect-play-button"
                title={lf("Play")}
                onClick={play}
                leftIcon="fas fa-play"
                />
            <SoundControls sound={sound} onSoundChange={handleSoundChange} handleStartAnimationRef={handleControlsAnimationRef} />
            <Button
                className="link-button"
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
            <SoundGallery
                sounds={getGallerySounds()}
                onSoundSelected={handleGallerySelection}
                visible={selectedView === "gallery"}
                />
        </div>
    </div>
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

    newFrequencyDifference = clamp(newFrequencyDifference, -2000, 2000);

    res.startFrequency = clamp(
        Math.random() * 2000,
        Math.max(-newFrequencyDifference, 1),
        clamp(2000 - newFrequencyDifference, 1, 2000)
    );

    res.endFrequency = clamp(res.startFrequency + newFrequencyDifference, 1, 2000);

    // Same strategy for volume
    const oldVolumeDifference = res.endVolume - res.startVolume;
    let newVolumeDifference = oldVolumeDifference + oldVolumeDifference * (Math.random() - 0.5);

    newVolumeDifference = clamp(newVolumeDifference, -1023, 1023);

    if (Math.sign(oldVolumeDifference) !== Math.sign(newVolumeDifference)) {
        newVolumeDifference *= -1;
    }

    res.startVolume = clamp(
        Math.random() * 1023,
        Math.max(-newVolumeDifference, 0),
        clamp(1023 - newVolumeDifference, 0, 1023)
    );

    res.endVolume = clamp(res.startVolume + newVolumeDifference, 0, 1023);

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