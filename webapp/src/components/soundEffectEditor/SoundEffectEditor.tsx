import * as React from "react";
import { Button } from "../../../../react-common/components/controls/Button";
import { SoundControls } from "./SoundControls";
import { SoundEffectHeader } from "./SoundEffectHeader";
import { SoundPreview } from "./SoundPreview";

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
    let previewSynthListener: (freq: number, vol: number) => void;

    const play = () => {
        const codalSound = new pxsim.codal.music.Sound();
        codalSound.frequency = sound.startFrequency;
        codalSound.volume = sound.startVolume;
        codalSound.endFrequency = sound.endFrequency;
        codalSound.endVolume = sound.endVolume;

        switch (sound.wave) {
            case "sine": codalSound.wave = pxsim.codal.music.WaveShape.Sine; break;
            case "triangle": codalSound.wave = pxsim.codal.music.WaveShape.Triangle; break;
            case "square": codalSound.wave = pxsim.codal.music.WaveShape.Square; break;
            case "sawtooth": codalSound.wave = pxsim.codal.music.WaveShape.Sawtooth; break;
            case "noise": codalSound.wave = pxsim.codal.music.WaveShape.Noise; break;
        }

        switch (sound.interpolation) {
            case "linear": codalSound.shape = pxsim.codal.music.InterpolationEffect.Linear; break;
            case "curve": codalSound.shape = pxsim.codal.music.InterpolationEffect.Curve;  break;
            case "logarithmic": codalSound.shape = pxsim.codal.music.InterpolationEffect.Logarithmic;  break;
        }

        // These values were chosen through trial and error to get something
        // that sounded pleasing and is most like the intended effect
        switch (sound.effect) {
            case "vibrato":
                codalSound.fx = pxsim.codal.music.Effect.Vibrato;
                codalSound.fxnSteps = 512;
                codalSound.fxParam = 2;
                break;
            case "tremolo":
                codalSound.fx = pxsim.codal.music.Effect.Tremolo;
                codalSound.fxnSteps = 900;
                codalSound.fxParam = 3;
                break;
            case "warble":
                codalSound.fx = pxsim.codal.music.Effect.Warble;
                codalSound.fxnSteps = 700;
                codalSound.fxParam = 2;
                break;
        }

        codalSound.duration = sound.duration
        codalSound.steps = 90;

        if (cancelSound) cancelSound();
        let cancelled = false;
        cancelSound = () => {
            cancelled = true;
            if (startPreviewAnimation) startPreviewAnimation(-1);
            if (startControlsAnimation) startControlsAnimation(-1);
        }

        if (startPreviewAnimation) startPreviewAnimation(sound.duration);
        if (startControlsAnimation) startControlsAnimation(sound.duration);
        pxsim.codal.music.playSoundExpressionAsync(codalSound.src, () => cancelled, previewSynthListener);
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

    const handleSynthListenerRef = (onPull: (freq: number, vol: number) => void) => {
        previewSynthListener = onPull;
    }

    const handleSoundChange = (newSound: pxt.assets.Sound, setSoundSeed = true) => {
        if (cancelSound) cancelSound();
        if (setSoundSeed) setSimilarSoundSeed(undefined);
        setSound(newSound);
        if (onSoundChange) onSoundChange(newSound);
    }

    return <div className="sound-effect-editor">
        <SoundEffectHeader
            selectedView={selectedView}
            onViewSelected={onViewSelected}
            onClose={handleClose}
        />
        <SoundPreview sound={sound} handleStartAnimationRef={handlePreviewAnimationRef} handleSynthListenerRef={handleSynthListenerRef} />
        <Button
            className="sound-effect-play-button"
            title={lf("Play")}
            onClick={play}
            leftIcon="fas fa-play"
            />
        <SoundControls sound={sound} onSoundChange={handleSoundChange} handleStartAnimationRef={handleControlsAnimationRef} />
        <Button
            label={pxt.U.lf("Generate Similar Sound")}
            title={pxt.U.lf("Generate Similar Sound")}
            onClick={() => {
                if (!similarSoundSeed) {
                    setSimilarSoundSeed(sound);
                    handleSoundChange(generateSimilarSound(sound), false);
                }
                else {
                    handleSoundChange(generateSimilarSound(similarSoundSeed), false);
                }
                play();
            }}
        />
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
        Math.min(2000, 2000 - newFrequencyDifference)
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
        Math.min(1023, 1023 - newVolumeDifference)
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