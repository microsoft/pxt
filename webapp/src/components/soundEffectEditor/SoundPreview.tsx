import * as React from "react";
import { CancellationToken } from "./SoundEffectEditor";

export interface SoundPreviewProps {
    sound: pxt.assets.Sound;
    handleStartAnimationRef?: (startAnimation: (duration: number) => void) => void;
    handleSynthListenerRef?: (onPull: (data: Float32Array, fft: Uint8Array, sound: pxt.assets.Sound, cancelToken: CancellationToken) => void) => void;
}

export const SoundPreview = (props: SoundPreviewProps) => {
    const { sound, handleStartAnimationRef, handleSynthListenerRef } = props;

    const aspectRatio = 30/8;

    const width = 1000;
    const height = width / aspectRatio;

    let animationPath: SVGPathElement;
    let previewPath: SVGPathElement;
    let animationStartTime: number;

    const onAnimateRef = () => {
        if (!animationPath || !previewPath) return;

        handleStartAnimationRef((duration: number) => {
            if (duration <= 0) {
                animationStartTime = 0;
                return;
            }
            let toDraw = sound;
            let freqData: Float32Array;
            let fftData: Uint8Array;
            let cancelToken: CancellationToken = null;

            handleSynthListenerRef((data, fft, sound, token) => {
                freqData = data;
                fftData = fft;
                toDraw = sound;
                cancelToken = token;
            })

            const doAnimationFrame = () => {
                if (!animationPath) return;
                const dt = Date.now() - animationStartTime;

                if (cancelToken?.cancelled || dt > toDraw.duration) {
                    animationPath.setAttribute("opacity", "0");
                    previewPath.setAttribute("opacity", "1");
                    return;
                }
                animationPath.setAttribute("opacity", "1");
                previewPath.setAttribute("opacity", "0");

                if (freqData) {
                    animationPath.setAttribute("d", renderWaveSnapshot(freqData, width, height))
                    // animationPath.setAttribute("d", renderFrequencyContent(fftData, width, height))
                }

                requestAnimationFrame(doAnimationFrame);
            }

            animationStartTime = Date.now();
            requestAnimationFrame(doAnimationFrame);
        })
    }

    let getFrequencyAt: (t: number) => number;

    switch (sound.interpolation) {
        case "linear":
            getFrequencyAt = t => sound.startFrequency + t * (sound.endFrequency - sound.startFrequency) / sound.duration;
            break;
        case "curve":
            getFrequencyAt = t => sound.startFrequency + (sound.endFrequency - sound.startFrequency) * Math.sin(t / sound.duration * (Math.PI / 2));
            break;
        case "logarithmic":
            getFrequencyAt = t => sound.startFrequency + Math.log10(1 + 9 * (t / sound.duration)) * (sound.endFrequency - sound.startFrequency)
            break;
    }

    const handleAnimationPathRef = (ref: SVGPathElement) => {
        if (ref) animationPath = ref;
        onAnimateRef();
    }

    const handlePreviewPathRef = (ref: SVGPathElement) => {
        if (ref) previewPath = ref;
        onAnimateRef();
    }

    return <div className="sound-preview">
        <svg viewBox={`0 0 ${width} ${height}`} xmlns="http://www.w3.org/2000/svg">
            <path
                className="sound-preview-baseline"
                d={`M ${0} ${height / 2} h ${width}`} fill="none"
                strokeWidth="2px" />
            <path
                ref={handlePreviewPathRef}
                className="sound-preview-static-wave"
                d={pxt.assets.renderSoundPath(sound, width, height)}
                fill="none"
                strokeWidth="4px"
                strokeLinejoin="round"/>
            <path
                ref={handleAnimationPathRef}
                className="sound-preview-animated-wave"
                d=""
                fill="none"
                strokeWidth="6px"
                strokeLinejoin="round"/>
            <rect x="-2" y="0" width="1" height="100%" fill="grey"/>
        </svg>
    </div>
}

function renderWaveSnapshot(data: Float32Array, width: number, height: number) {
    const xSlice = width / (data.length * 0.75);

    const parts: string[] = [];

    const MIN_VALUE = -0.125;
    const MAX_VALUE = 0.125;

    let currentSign = 0;

    const crossings: number[] = [];

    let res = "";
    for (let i = 0; i < data.length; ++i) {
        const sign = Math.sign(data[i]);

        if (sign !== currentSign) {
            currentSign = sign;
            crossings.push(i);

            res += currentSign + " ";
        }
    }

    let middleCrossing = data.length >> 1;

    if (crossings.length) {
        let middleIndex = Math.floor(crossings.length / 2);
        while (data[crossings[middleIndex]] <=0) {
            middleIndex++;
        }
        middleCrossing = crossings[middleIndex];
    }

    for (let i = 0; i < data.length; ++i) {
        const x = (width / 2) + (i - middleCrossing) * xSlice;
        const y = (height / 2) + data[i] * (height / (MAX_VALUE - MIN_VALUE));

        let op = "L"
        if (parts.length === 0) {
            op = "M";
        }

        parts.push(`${op} ${x} ${height - y}`);
    }

    return parts.join(" ");
}

function renderFrequencyContent(data: Uint8Array, width: number, height: number) {
    const xSlice = width / data.length;

    const parts: string[] = [];

    for (let i = 0; i < data.length; ++i) {
        const x = i * xSlice;
        const y = (data[i] / 255) * height;

        let op = "L"
        if (parts.length === 0) {
            op = "M";
        }

        parts.push(`${op} ${x} ${height - y}`);
    }

    return parts.join(" ");
}