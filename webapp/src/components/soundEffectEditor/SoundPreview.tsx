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
            pathAnimation.setAttribute("dur", duration + "ms");
            rectAnimation.setAttribute("dur", duration + "ms");
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
                <linearGradient id="preview-fill" x1="100%" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#E63022"/>
                    <stop offset="0%" stopColor="grey"/>
                    <animate ref={handlePathAnimateRef} attributeName="x1" from="0%" to="100%" dur="1000ms" begin="indefinite" />
                </linearGradient>
            </defs>
            <path d={`M ${0} ${height / 2} h ${width}`} fill="none" stroke="grey" strokeWidth="2px" />
            <path d={pxt.assets.renderSoundPath(sound, width, height)} fill="none" stroke="url('#preview-fill')" strokeWidth="4px"/>
            <rect x="-2" y="0" width="1" height="100%" fill="grey">
                <animate ref={handleRectAnimateRef} attributeName="x" from="0%" to="100%" dur="1000ms" begin="indefinite" />
            </rect>
        </svg>
    </div>
}

