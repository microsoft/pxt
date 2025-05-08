import * as React from "react";

import { Dropdown, DropdownItem } from "../../../../react-common/components/controls/Dropdown";
import { RadioButtonGroup, RadioGroupChoice } from "../../../../react-common/components/controls/RadioButtonGroup";
import { Input } from "../../../../react-common/components/controls/Input";
import { DraggableGraph } from "../../../../react-common/components/controls/DraggableGraph";
import { BlocklyKeyboardIntercept } from "../../BlocklyKeyboardIntercept";


export interface SoundControlsProps {
    onSoundChange: (newValue: pxt.assets.Sound) => void;
    sound: pxt.assets.Sound;
    handleStartAnimationRef?: (startAnimation: (duration: number) => void) => void;
}

export const SoundControls = (props: SoundControlsProps) => {
    const { onSoundChange, sound, handleStartAnimationRef } = props;

    const waveformOptions: RadioGroupChoice[] = [
        {
            title: getWaveformLabel("sine"),
            id: "sine",
            icon: "xicon sound-sine"
        },
        {
            title: getWaveformLabel("square"),
            id: "square",
            icon: "xicon sound-square"
        },
        {
            title: getWaveformLabel("sawtooth"),
            id: "sawtooth",
            icon: "xicon sound-saw"
        },
        {
            title: getWaveformLabel("triangle"),
            id: "triangle",
            icon: "xicon sound-triangle"
        },
        {
            title: getWaveformLabel("noise"),
            id: "noise",
            icon: "xicon sound-noise"
        }
    ]

    const onWaveformSelected = (id: string) => {
        onSoundChange({
            ...sound,
            wave: id as pxt.assets.SoundWaveForm
        });
    }

    const interpolationOptions: DropdownItem[] = [
        {
            label: pxt.U.lf("Linear"),
            leftIcon: "xicon sound-linear",
            title: pxt.U.lf("Linear"),
            id: "linear"
        },
        {
            label: pxt.U.lf("Curve"),
            leftIcon: "xicon sound-curve",
            title: pxt.U.lf("Curve"),
            id: "curve"
        },
        {
            label: pxt.U.lf("Logarithmic"),
            leftIcon: "xicon sound-logarithmic",
            title: pxt.U.lf("Logarithmic"),
            id: "logarithmic"
        }
    ];

    const onInterpolationSelected = (id: string) => {
        onSoundChange({
            ...sound,
            interpolation: id as pxt.assets.SoundInterpolation
        });
    }

    const effectOptions: DropdownItem[] = [
        {
            label: pxt.U.lf("None"),
            leftIcon: "xicon sound-none",
            title: pxt.U.lf("None"),
            id: "none"
        },
        {
            label: pxt.U.lf("Vibrato"),
            leftIcon: "xicon sound-vibrato",
            title: pxt.U.lf("Vibrato"),
            id: "vibrato"
        },
        {
            label: pxt.U.lf("Tremolo"),
            leftIcon: "xicon sound-tremolo",
            title: pxt.U.lf("Tremolo"),
            id: "tremolo"
        },
        {
            label: pxt.U.lf("Warble"),
            leftIcon: "xicon sound-warble",
            title: pxt.U.lf("Warble"),
            id: "warble"
        }
    ];

    const onEffectSelected = (id: string) => {
        onSoundChange({
            ...sound,
            effect: id as pxt.assets.SoundEffect
        });
    }

    const onOptionSelected = (newValue: string) => {
        pxt.tickEvent("soundeffect.durationSelected", { option: newValue });
        onDurationChange(newValue);
    }

    const onDurationChange = (newValue: string) => {
        const val = parseInt(newValue);

        if (!isNaN(val)) {
            onSoundChange({
                ...sound,
                duration: Math.max(Math.min(val | 0, 9999), 1)
            });
        }
    }

    const onVolumeChange = (index: number, newValue: number) => {
        if (index === 0) {
            onSoundChange({
                ...sound,
                startVolume: newValue
            })
        }
        else {
            onSoundChange({
                ...sound,
                endVolume: newValue
            })
        }
    }

    const onFrequencyChange = (index: number, newValue: number) => {
        if (index === 0) {
            onSoundChange({
                ...sound,
                startFrequency: newValue
            })
        }
        else {
            onSoundChange({
                ...sound,
                endFrequency: newValue
            })
        }
    }

    let startFreqAnimation: (duration: number) => void;
    let startVolumeAnimation: (duration: number) => void;

    const handleFreqAnimationRef = (startAnimation: (duration: number) => void) => {
        startFreqAnimation = startAnimation;
    }

    const handleVolumeAnimationRef = (startAnimation: (duration: number) => void) => {
        startVolumeAnimation = startAnimation;
    }

    if (handleStartAnimationRef) {
        handleStartAnimationRef((duration: number) => {
            if (startFreqAnimation) startFreqAnimation(duration);
            if (startVolumeAnimation) startVolumeAnimation(duration);
        });
    }

    return <div className="sound-controls">
        <div className="waveform-and-duration">
            <div className="waveform-control-label">
                <span className="sound-label">
                    {pxt.U.lf("Waveform:")}
                </span>
                <span className="sound-label waveform-name">
                    {getWaveformLabel(sound.wave)}
                </span>
            </div>
            <div className="waveform-and-duration-controls">
                <RadioButtonGroup
                    className="common-radio-buttons"
                    id="waveform-select"
                    choices={waveformOptions}
                    selectedId={sound.wave}
                    onChoiceSelected={onWaveformSelected}
                />
                <div className="duration-controls">
                    <div className="sound-label">
                        {pxt.U.lf("Duration (ms)")}
                    </div>
                    <BlocklyKeyboardIntercept
                    keyCodes={[
                        13, /* Enter */
                        27, /* Escape */
                    ]}>
                        <Input
                            id="sound-duration-input"
                            initialValue={sound.duration + ""}
                            className="sound-duration-input"
                            onEnterKey={onDurationChange}
                            treatSpaceAsEnter={true}
                            onBlur={onDurationChange}
                            onOptionSelected={onOptionSelected}
                            ariaLabel={pxt.U.lf("Duration (milliseconds)")}
                            options={
                                {
                                    [pxt.U.lf("100 ms")]: "100",
                                    [pxt.U.lf("200 ms")]: "200",
                                    [pxt.U.lf("500 ms")]: "500",
                                    [pxt.U.lf("1 second")]: "1000",
                                    [pxt.U.lf("2 seconds")]: "2000",
                                    [pxt.U.lf("5 seconds")]: "5000"
                                }
                            }
                        />
                    </BlocklyKeyboardIntercept>
                </div>
            </div>
        </div>
        <div className="sound-graph-container">
            <div className="frequency-graph">
                <div className="sound-graph-header">
                    <span className="sound-label">
                        {pxt.U.lf("Frequency")}
                    </span>
                    <div className="dropdown-and-label">
                        <span className="sound-label">
                            {pxt.U.lf("Effect")}
                        </span>

                        <Dropdown
                            id="effect-dropdown"
                            className="icon-preview"
                            selectedId={sound.effect}
                            onItemSelected={onEffectSelected}
                            items={effectOptions}
                        />
                    </div>
                    <div className="dropdown-and-label">
                        <span className="sound-label">
                            {pxt.U.lf("Interpolation")}
                        </span>
                        <Dropdown
                            id="interpolation-dropdown"
                            className="icon-preview hang-left"
                            selectedId={sound.interpolation}
                            onItemSelected={onInterpolationSelected}
                            items={interpolationOptions}
                        />
                    </div>
                </div>
                <DraggableGraph
                    min={1}
                    max={pxt.assets.MAX_FREQUENCY}
                    aspectRatio={3}
                    valueUnits={pxt.U.lf("Hz")}
                    points={[sound.startFrequency, sound.endFrequency]}
                    interpolation={sound.interpolation}
                    onPointChange={onFrequencyChange}
                    handleStartAnimationRef={handleFreqAnimationRef}
                    squiggly={sound.effect === "vibrato" || sound.effect === "warble"}
                />
            </div>
            <div className="volume-graph">
                <div className="sound-graph-header">
                    <span className="sound-label">
                        {pxt.U.lf("Volume")}
                    </span>
                </div>
                <DraggableGraph
                    min={0}
                    max={pxt.assets.MAX_VOLUME}
                    aspectRatio={5}
                    points={[sound.startVolume, sound.endVolume]}
                    interpolation="linear"
                    onPointChange={onVolumeChange}
                    handleStartAnimationRef={handleVolumeAnimationRef}
                    squiggly={sound.effect === "tremolo"}
                />
            </div>
        </div>
    </div>
}


function getWaveformLabel(waveform: pxt.assets.SoundWaveForm) {
    switch (waveform) {
        case "sine": return pxt.U.lf("Sine");
        case "square": return pxt.U.lf("Square");
        case "triangle": return pxt.U.lf("Triangle");
        case "sawtooth": return pxt.U.lf("Sawtooth");
        case "noise": return pxt.U.lf("Noise");
    }
}