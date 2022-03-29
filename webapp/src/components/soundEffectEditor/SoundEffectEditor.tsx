import * as React from "react";
import { Button } from "../../../../react-common/components/controls/Button";
import { SoundControls } from "./SoundControls";
import { SoundEffectHeader } from "./SoundEffectHeader";
import { SoundPreview } from "./SoundPreview";

export interface SoundEffectEditorProps {

}

export const SoundEffectEditor = (props: SoundEffectEditorProps) => {
    const [ selectedView, setSelectedView ] = React.useState<"editor" | "gallery">("editor");

    const [ sound, setSound ] = React.useState<pxt.assets.Sound>({
        wave: "sine",
        interpolation: "linear",
        effect: "vibrato",
        startFrequency: 100,
        endFrequency: 1800,
        startVolume: 1023,
        endVolume: 0,
        duration: 1000
    });

    let startPreviewAnimation: (duration: number) => void;
    let startControlsAnimation: (duration: number) => void;
    let cancelSound: () => void;

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

        // These values were chosen through trial and error to get a sound
        // that sounded pleasing and most like the intended effect
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
            if (startPreviewAnimation) startPreviewAnimation(1);
            if (startControlsAnimation) startControlsAnimation(1);
        }

        if (startPreviewAnimation) startPreviewAnimation(sound.duration);
        if (startControlsAnimation) startControlsAnimation(sound.duration);
        pxsim.codal.music.playSoundExpressionAsync(codalSound.src, () => cancelled);
    }

    const onClose = () => {

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

    const handleSoundChange = (newSound: pxt.assets.Sound) => {
        if (cancelSound) cancelSound();
        setSound(newSound);
    }

    return <div className="sound-effect-editor">
        <SoundEffectHeader
            selectedView={selectedView}
            onViewSelected={onViewSelected}
            onClose={onClose}
        />
        <SoundPreview sound={sound} handleStartAnimationRef={handlePreviewAnimationRef} />
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
            onClick={() => {}}
        />
    </div>
}