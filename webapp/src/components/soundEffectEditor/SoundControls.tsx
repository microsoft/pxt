import * as React from "react";

import { Dropdown, DropdownItem } from "../../../../react-common/components/controls/Dropdown";
import { RadioButtonGroup, RadioGroupChoice } from "../../../../react-common/components/controls/RadioButtonGroup";
import { Input } from "../../../../react-common/components/controls/Input";



export interface SoundControlsProps {

}

export const SoundControls = (props: SoundControlsProps) => {

    const [ effect, setEffect ] = React.useState<pxt.assets.Sound>({
        wave: "sine",
        interpolation: "linear",
        effect: "vibrato",
        startFrequency: 0,
        endFrequency: 500,
        startVolume: 500,
        endVolume: 0,
        duration: 1000
    });

    const waveformOptions: RadioGroupChoice[] = [
        {
            title: getWaveformLabel("sine"),
            id: "sine",
            icon: "fas fa-slash"
        },
        {
            title: getWaveformLabel("square"),
            id: "square",
            icon: "fas fa-slash"
        },
        {
            title: getWaveformLabel("sawtooth"),
            id: "sawtooth",
            icon: "fas fa-slash"
        },
        {
            title: getWaveformLabel("triangle"),
            id: "triangle",
            icon: "fas fa-slash"
        },
        {
            title: getWaveformLabel("noise"),
            id: "noise",
            icon: "fas fa-slash"
        }
    ]

    const onWaveformSelected = (id: string) => {
        setEffect({
            ...effect,
            wave: id as pxt.assets.SoundWaveForm
        });
    }

    const interpolationOptions: DropdownItem[] = [
        {
            label: pxt.U.lf("Linear"),
            leftIcon: "fas fa-slash",
            title: pxt.U.lf("Linear"),
            id: "linear"
        },
        {
            label: pxt.U.lf("None"),
            leftIcon: "fas fa-slash",
            title: pxt.U.lf("None"),
            id: "none"
        },
        {
            label: pxt.U.lf("Curve"),
            leftIcon: "fas fa-slash",
            title: pxt.U.lf("Curve"),
            id: "curve"
        },
        {
            label: pxt.U.lf("Exponential"),
            leftIcon: "fas fa-slash",
            title: pxt.U.lf("Exponential"),
            id: "exponential"
        }
    ];

    const onInterpolationSelected = (id: string) => {
        setEffect({
            ...effect,
            interpolation: id as pxt.assets.SoundInterpolation
        });
    }

    const effectOptions: DropdownItem[] = [
        {
            label: pxt.U.lf("None"),
            leftIcon: "fas fa-slash",
            title: pxt.U.lf("None"),
            id: "none"
        },
        {
            label: pxt.U.lf("Vibrato"),
            leftIcon: "fas fa-wave-sine",
            title: pxt.U.lf("Vibrato"),
            id: "vibrato"
        },
        {
            label: pxt.U.lf("Tremolo"),
            leftIcon: "fas fa-wave-square",
            title: pxt.U.lf("Tremolo"),
            id: "tremolo"
        },
        {
            label: pxt.U.lf("Warble"),
            leftIcon: "fas fa-waveform",
            title: pxt.U.lf("Warble"),
            id: "warble"
        }
    ];

    const onEffectSelected = (id: string) => {
        setEffect({
            ...effect,
            effect: id as pxt.assets.SoundEffect
        });
    }

    const onDurationChange = (newValue: string) => {
        const val = parseInt(newValue);

        if (!isNaN(val) && val > 0) {
            setEffect({
                ...effect,
                duration: val
            });
        }
    }

    return <div className="sound-controls">
        <div className="waveform-and-duration">
            <div className="waveform-control-label">
                <span className="sound-label">
                    {pxt.U.lf("Waveform:")}
                </span>
                <span className="sound-label waveform-name">
                    {getWaveformLabel(effect.wave)}
                </span>
            </div>
            <div className="waveform-and-duration-controls">
                <RadioButtonGroup
                    className="common-radio-buttons"
                    id="waveform-select"
                    choices={waveformOptions}
                    selectedId={effect.wave}
                    onChoiceSelected={onWaveformSelected}
                />
                <div className="duration-controls">
                    <div className="sound-label">
                        {pxt.U.lf("Duration (ms)")}
                    </div>
                    <Input
                        initialValue={effect.duration + ""}
                        className="sound-duration-input"
                        onEnterKey={onDurationChange}
                        onBlur={onDurationChange}
                    />
                </div>
            </div>
        </div>
        <div className="sound-graph-container">
            <div className="frequency-graph-header">
                <span className="sound-label">
                    {pxt.U.lf("Frequency (Hz)")}
                </span>
                <div className="dropdown-and-label">
                    <span className="sound-label">
                        {pxt.U.lf("Effect")}
                    </span>

                    <Dropdown
                        id="effect-dropdown"
                        className="icon-preview"
                        selectedId={effect.effect}
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
                        className="icon-preview"
                        selectedId={effect.interpolation}
                        onItemSelected={onInterpolationSelected}
                        items={interpolationOptions}
                    />
                </div>
            </div>
        </div>
    </div>
}


function getWaveformLabel(waveform: pxt.assets.SoundWaveForm) {
    switch(waveform) {
        case "sine": return pxt.U.lf("Sine");
        case "square": return pxt.U.lf("Square");
        case "triangle": return pxt.U.lf("Triangle");
        case "sawtooth": return pxt.U.lf("Sawtooth");
        case "noise": return pxt.U.lf("Noise");
    }
}