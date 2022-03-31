import * as React from "react";

export interface SoundPreviewProps {
    sound: pxt.assets.Sound;
    handleStartAnimationRef?: (startAnimation: (duration: number) => void) => void;
    handleSynthListenerRef?: (onPull: (freq: number, volume: number) => void) => void;
}

export const SoundPreview = (props: SoundPreviewProps) => {
    const { sound, handleStartAnimationRef, handleSynthListenerRef } = props;

    const aspectRatio = 30/8;

    const width = 1000;
    const height = width / aspectRatio;

    let pathAnimation: SVGAnimateElement;
    let rectAnimation: SVGAnimateElement;
    let animationPath: SVGPathElement;
    let previewPath: SVGPathElement;
    let animationStartTime: number;

    const onAnimateRef = () => {
        if (!pathAnimation || !rectAnimation) return;

        handleStartAnimationRef((duration: number) => {
            if (duration <= 0) {
                animationStartTime = 0;
                return;
            }
            let frequency = sound.startFrequency;
            let volume = sound.startVolume;

            handleSynthListenerRef((freq, vol) => {
                frequency = freq;
                volume = vol * 1023;
            })

            const doAnimationFrame = () => {
                if (!animationPath) return;
                const dt = Date.now() - animationStartTime;

                if (dt > sound.duration) {
                    animationPath.setAttribute("opacity", "0");
                    previewPath.setAttribute("opacity", "1");
                    return;
                }
                animationPath.setAttribute("opacity", "1");
                previewPath.setAttribute("opacity", "0");

                animationPath.setAttribute("d", pxt.assets.renderWaveSnapshot(frequency, volume, sound.wave, width, height, 10))

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

    const getVolumeAt = (t: number) =>
        ((sound.endVolume - sound.startVolume) / sound.duration) * t + sound.startVolume;

    const handlePathAnimateRef = (ref: SVGAnimateElement) => {
        if (ref) pathAnimation = ref;
        onAnimateRef();
    }

    const handleRectAnimateRef = (ref: SVGAnimateElement) => {
        if (ref) rectAnimation = ref;
        onAnimateRef();
    }

    const handleAnimationPathRef = (ref: SVGPathElement) => {
        if (ref) animationPath = ref;
    }

    const handlePreviewPathRef = (ref: SVGPathElement) => {
        if (ref) previewPath = ref;
    }

    return <div className="sound-preview">
        <svg viewBox={`0 0 ${width} ${height}`} xmlns="http://www.w3.org/2000/svg">
            <defs>
                <linearGradient id="preview-fill" x1="100%" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#E63022"/>
                    <stop offset="0%" stopColor="grey"/>
                    <animate ref={handlePathAnimateRef} attributeName="x1" from="0%" to="100%" dur="1000ms" begin="indefinite" />
                </linearGradient>
            </defs>
            <path d={`M ${0} ${height / 2} h ${width}`} fill="none" stroke="grey" strokeWidth="2px" />
            <path ref={handlePreviewPathRef} d={pxt.assets.renderSoundPath(sound, width, height)} fill="none" stroke="url('#preview-fill')" strokeWidth="4px" strokeLinejoin="round"/>
            <path ref={handleAnimationPathRef} d="" fill="none" stroke="#E63022" strokeWidth="6px" strokeLinejoin="round"/>
            <rect x="-2" y="0" width="1" height="100%" fill="grey">
                <animate ref={handleRectAnimateRef} attributeName="x" from="0%" to="100%" dur="1000ms" begin="indefinite" />
            </rect>
        </svg>
    </div>
}

