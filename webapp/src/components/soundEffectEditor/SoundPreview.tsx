import * as React from "react";

export interface SoundPreviewProps {
    sound: pxt.assets.Sound;
    handleStartAnimationRef?: (startAnimation: (duration: number) => void) => void;
}

export const SoundPreview = (props: SoundPreviewProps) => {
    const { sound, handleStartAnimationRef } = props;

    const aspectRatio = 30/8;

    const width = 1000;
    const height = width / aspectRatio;

    let pathAnimation: SVGAnimateElement;
    let rectAnimation: SVGAnimateElement;

    const onAnimateRef = () => {
        if (!pathAnimation || !rectAnimation) return;
        handleStartAnimationRef((duration: number) => {
            pathAnimation.setAttribute("duration", duration + "ms");
            rectAnimation.setAttribute("duration", duration + "ms");
            (pathAnimation as any).beginElement();
            (rectAnimation as any).beginElement();
        })
    }

    const handlePathAnimateRef = (ref: SVGAnimateElement) => {
        if (ref) pathAnimation = ref;
        onAnimateRef();
    }

    const handleRectAnimateRef = (ref: SVGAnimateElement) => {
        if (ref) rectAnimation = ref;
        onAnimateRef();
    }

    return <div className="sound-preview">
        <svg viewBox={`0 0 ${width} ${height}`} xmlns="http://www.w3.org/2000/svg">
            <defs>
                <linearGradient id="preview-fill" x1="100%">
                    <stop offset="0%" stop-color="#E63022"/>
                    <stop offset="0%" stop-color="grey"/>
                    <animate ref={handlePathAnimateRef} attributeName="x1" from="0%" to="100%" dur="1000ms" begin="indefinite" />
                </linearGradient>
            </defs>
            <path d={`M ${0} ${height / 2} h ${width}`} fill="none" stroke="grey" strokeWidth="2px" />
            <path d={renderSoundPath(sound, width, height)} fill="none" stroke="url('#preview-fill')" strokeWidth="4px"/>
            <rect x="-1" y="0" width="1" height="100%" fill="grey">
                <animate ref={handleRectAnimateRef} attributeName="x" from="0%" to="100%" dur="1000ms" begin="indefinite" />
            </rect>
        </svg>
    </div>
}

function renderSoundPath(sound: pxt.assets.Sound, width: number, height: number) {
    const {
        startFrequency,
        endFrequency,
        startVolume,
        endVolume,
        wave,
        interpolation
    } = sound;

    const logInterpolation = (start: number, end: number, percent: number) => {
        return Math.pow(start, 1 - percent) * Math.pow(end, percent)
    }

    const getFrequencyAt = (x: number) => {
        switch (interpolation) {
            case "logarithmic":
                return logInterpolation(startFrequency, endFrequency, x / width);
            case "linear":
            default:
                return ((endFrequency - startFrequency) / width) * x + startFrequency;
        }
    }

    const getVolumeAt = (x: number) =>
        ((endVolume - startVolume) / width) * x + startVolume;

    const volumeToAmplitude = (volume: number) => (volume / 1023) * (height - 2) / 2;
    const frequencyToWidth = (frequency: number) => Math.min(width, Math.max(10, (1 / logInterpolation(1, 4000, frequency / 4000)) * width / 2));

    const parts: string[] = [`M ${2} ${height / 2}`];

    let currentX = 0;

    while (currentX < width) {
        parts.push(renderHalfWavePart(
            volumeToAmplitude(getVolumeAt(currentX)),
            frequencyToWidth(getFrequencyAt(currentX)) / 2,
            wave,
            false
        ))
        currentX += frequencyToWidth(getFrequencyAt(currentX)) / 2
        parts.push(renderHalfWavePart(
            volumeToAmplitude(getVolumeAt(currentX)),
            frequencyToWidth(getFrequencyAt(currentX)) / 2,
            wave,
            true
        ))
        currentX += frequencyToWidth(getFrequencyAt(currentX)) / 2
    }

    return parts.join(" ");
}

function renderWavePart(amplitude: number, width: number, wave: pxt.assets.SoundWaveForm) {
    switch (wave) {
        case "triangle":
            return `l ${width / 4} ${-amplitude} l ${width / 2} ${amplitude * 2} l ${width / 4} ${-amplitude}`;
        case "square":
            return `v ${-amplitude} h ${width / 2} v ${amplitude * 2} h ${width / 2} v ${-amplitude}`;
        case "sawtooth":
            return `v ${-amplitude} l ${width} ${amplitude * 2} v ${-amplitude}`;
        case "sine":
            return `v ${-amplitude} l ${width} ${amplitude * 2} v ${-amplitude}`;
        case "noise":
            return `v ${-amplitude} l ${width} ${amplitude * 2} v ${-amplitude}`;

    }
}

function renderHalfWavePart(amplitude: number, width: number, wave: pxt.assets.SoundWaveForm, flip: boolean) {
    switch (wave) {
        case "triangle":
            return `l ${width / 2} ${flip ? amplitude : -amplitude} l ${width / 2} ${flip ? -amplitude : amplitude}`;
        case "square":
            return `v ${flip ? amplitude : -amplitude} h ${width} v ${flip ? -amplitude : amplitude}`;
        case "sawtooth":
            if (flip) {
                return `l ${width} ${amplitude} v ${-amplitude}`
            }
            else {
                return `v ${-amplitude} l ${width} ${amplitude}`
            }
        case "sine":
            return `l ${width / 2} ${flip ? amplitude : -amplitude} l ${width / 2} ${flip ? -amplitude : amplitude}`;
        case "noise":
            return `l ${width / 2} ${flip ? amplitude : -amplitude} l ${width / 2} ${flip ? -amplitude : amplitude}`;

    }
}