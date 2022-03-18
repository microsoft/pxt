import * as React from "react";

import { Dropdown, DropdownItem } from "../../../../react-common/components/controls/Dropdown";


export interface SoundControlsProps {

}

export const SoundControls = (props: SoundControlsProps) => {
    const interpolationOptions: DropdownItem[] = [
        {
            label: pxt.U.lf("Linear"),
            leftIcon: "fas fa-slash",
            title: pxt.U.lf("Linear"),
            onClick: () => {},
            id: "linear"
        },
        {
            label: pxt.U.lf("None"),
            leftIcon: "fas fa-slash",
            title: pxt.U.lf("None"),
            onClick: () => {},
            id: "none"
        },
        {
            label: pxt.U.lf("Curve"),
            leftIcon: "fas fa-slash",
            title: pxt.U.lf("Curve"),
            onClick: () => {},
            id: "curve"
        },
        {
            label: pxt.U.lf("Exponential"),
            leftIcon: "fas fa-slash",
            title: pxt.U.lf("Exponential"),
            onClick: () => {},
            id: "exponential"
        }
    ];

    const effectOptions: DropdownItem[] = [
        {
            label: pxt.U.lf("None"),
            leftIcon: "fas fa-slash",
            title: pxt.U.lf("None"),
            onClick: () => {},
            id: "none"
        },
        {
            label: pxt.U.lf("Vibrato"),
            leftIcon: "fas fa-wave-sine",
            title: pxt.U.lf("Vibrato"),
            onClick: () => {},
            id: "vibrato"
        },
        {
            label: pxt.U.lf("Tremolo"),
            leftIcon: "fas fa-wave-square",
            title: pxt.U.lf("Tremolo"),
            onClick: () => {},
            id: "tremolo"
        },
        {
            label: pxt.U.lf("Warble"),
            leftIcon: "fas fa-waveform",
            title: pxt.U.lf("Warble"),
            onClick: () => {},
            id: "warble"
        }
    ];
    return <div className="sound-controls">
        <div className="frequency-graph-header">
            <span>
                {pxt.U.lf("Frequency (Hz)")}
            </span>
            <div className="dropdown-and-label">
                <span className="dropdown-label">
                    {pxt.U.lf("Effect")}
                </span>

                <Dropdown
                    id="effect-dropdown"
                    className="icon-preview"
                    selectedId="none"
                    onItemSelected={() => {}}
                    items={effectOptions}
                />
            </div>
            <div className="dropdown-and-label">
                <span className="dropdown-label">
                    {pxt.U.lf("Interpolation")}
                </span>
                <Dropdown
                    id="interpolation-dropdown"
                    className="icon-preview"
                    selectedId="linear"
                    onItemSelected={() => {}}
                    items={interpolationOptions}
                />
            </div>
        </div>
    </div>
}