import * as React from "react";
import * as ReactDOM from "react-dom";
import { Button } from "./Button";
import { Confetti } from "../animations/Confetti";
import { ContainerProps, classList } from "../util";
import { FocusTrap } from "./FocusTrap";
import { useEffect } from "react";


export interface CutoutBounds {
    top: number;
    bottom: number;
    left: number;
    right: number;
    width: number;
    height: number;
}

export interface TeachingBubbleProps extends ContainerProps {
    targetContent: pxt.tour.BubbleStep;
    stepNumber: number;
    totalSteps: number;
    hasPrevious: boolean;
    hasNext: boolean;
    onClose: () => void;
    parentElement?: Element;
    activeTarget?: boolean; // if true, the target is clickable
    showConfetti?: boolean;
    forceHideSteps?: boolean;
    onNext: () => void;
    onBack: () => void;
    onFinish: () => void;
}

export const TeachingBubble = (props: TeachingBubbleProps) => {
    const {
        id,
        className,
        ariaLabel,
        ariaHidden,
        ariaDescribedBy,
        role,
        targetContent,
        onClose,
        onNext,
        onBack,
        onFinish,
        stepNumber,
        totalSteps,
        parentElement,
        activeTarget,
        forceHideSteps,
        hasPrevious,
        hasNext
    } = props;

    const margin = 10;
    const outlineOffset = 2.5;
    const tryFit = {
        above: false,
        below: false,
        left: false,
        right: false
    }

    useEffect(() => {
        if (props.targetContent.onStepBegin) {
            props.targetContent.onStepBegin();
        }
        positionBubbleAndCutout();
        window.addEventListener("resize", positionBubbleAndCutout);
        return () => {
            window.removeEventListener("resize", positionBubbleAndCutout);
        }
    }, [stepNumber, targetContent]);

    const positionBubbleAndCutout = () => {
        const bubble = document.getElementById(id);
        const bubbleArrow = document.querySelector(".teaching-bubble-arrow") as HTMLElement;
        bubbleArrow.style.border = "none";
        const bubbleArrowOutline = document.querySelector(".teaching-bubble-arrow-outline") as HTMLElement;
        bubbleArrowOutline.style.border = "none";
        const bubbleBounds = bubble.getBoundingClientRect();
        let cutoutBounds: CutoutBounds;
        if (!targetContent.targetQuery || targetContent.targetQuery === "nothing") {
            cutoutBounds = {
                top: window.innerHeight / 2,
                bottom: 0,
                left: window.innerWidth / 2,
                right: 0,
                width: 0,
                height: 0
            }
        } else {
            const targetElement = document.querySelector(targetContent.targetQuery) as HTMLElement;
            const targetBounds = targetElement.getBoundingClientRect();
            cutoutBounds = getCutoutBounds(targetBounds, targetElement);
        }
        setCutout(cutoutBounds);
        setPosition(cutoutBounds, bubble, bubbleBounds, bubbleArrow, bubbleArrowOutline);
    }

    const getCutoutBounds = (targetBounds: DOMRect, targetElement: HTMLElement): CutoutBounds => {
        let cutoutTop = targetBounds.top;
        let cutoutLeft = targetBounds.left;
        let cutoutWidth = targetBounds.width;
        let cutoutHeight = targetBounds.height;
        if (targetContent.sansQuery) { // TO DO - take care of cases when sansElement is not to the left or below
            const sansElement = document.querySelector(targetContent.sansQuery) as HTMLElement;
            const sansBounds = sansElement.getBoundingClientRect();
            const tempBounds: CutoutBounds = {
                top: cutoutTop,
                bottom: cutoutTop + cutoutHeight,
                left: cutoutLeft,
                right: cutoutLeft + cutoutWidth,
                width: cutoutWidth,
                height: cutoutHeight
            }
            // check that cutout intersects with sansElement
            if (collision(tempBounds, sansBounds)) {
                if (targetContent.sansLocation === pxt.tour.BubbleLocation.Left) {
                    cutoutLeft = targetBounds.left + sansBounds.width;
                    cutoutWidth = targetBounds.width - sansBounds.width;
                } else if (targetContent.sansLocation === pxt.tour.BubbleLocation.Below) {
                    cutoutHeight = targetBounds.height - sansBounds.height;
                    if (tempBounds.bottom > window.innerHeight) {
                        cutoutHeight -= tempBounds.bottom - window.innerHeight;
                    }
                }
            }
        }
        // make cutout bigger if no padding and not centered
        if (targetContent.location !== pxt.tour.BubbleLocation.Center) {
            const paddingTop = parseFloat(window.getComputedStyle(targetElement).paddingTop);
            const paddingRight = parseFloat(window.getComputedStyle(targetElement).paddingRight);
            const paddingBottom = parseFloat(window.getComputedStyle(targetElement).paddingBottom);
            const paddingLeft = parseFloat(window.getComputedStyle(targetElement).paddingLeft);
            if (paddingTop < margin) {
                cutoutTop -= margin + paddingTop;
                cutoutHeight += margin - paddingTop;
            }
            if (paddingBottom < margin) {
                cutoutHeight += margin - paddingBottom;
            }
            if (paddingLeft < margin) {
                cutoutLeft -= margin + paddingLeft;
                cutoutWidth += margin - paddingLeft;
            }
            if (paddingRight < margin) {
                cutoutWidth += margin - paddingRight;
            }
        }
        const cutoutRight = cutoutLeft + cutoutWidth;
        const cutoutBottom = cutoutTop + cutoutHeight;
        const cutoutBounds: CutoutBounds = {
            top: cutoutTop,
            bottom: cutoutBottom,
            left: cutoutLeft,
            right: cutoutRight,
            width: cutoutWidth,
            height: cutoutHeight
        }
        return cutoutBounds;
    }

    const setCutout = (cutoutBounds: CutoutBounds) => {
        const cutout = document.querySelector(".teaching-bubble-cutout") as HTMLElement;
        cutout.style.top = `${cutoutBounds.top}px`;
        cutout.style.height = `${cutoutBounds.height}px`;
        cutout.style.left = `${cutoutBounds.left}px`;
        cutout.style.width = `${cutoutBounds.width}px`;

        if (activeTarget) {
            cutout.style.pointerEvents = "none";
        }
    }

    const resetTryFit = () => {
        tryFit.above = false;
        tryFit.below = false;
        tryFit.left = false;
        tryFit.right = false;
    }

    const setPosition = (cutoutBounds: CutoutBounds, bubble: HTMLElement, bubbleBounds: DOMRect, bubbleArrow: HTMLElement, bubbleArrowOutline: HTMLElement) => {
        bubbleArrowOutline.style.opacity = "1";
        bubbleArrow.style.opacity = "1";
        resetTryFit();
        const transparentBorder = `${margin}px solid transparent`;
        const opaqueBorder = `${margin}px solid`;
        const transparentOutline = `${margin + outlineOffset}px solid transparent`;
        const opaqueOutline = `${margin + outlineOffset}px solid`;

        const positionAbove = () => {
            const top = cutoutBounds.top - bubbleBounds.height - margin;
            const left = cutoutBounds.left - (bubbleBounds.width - cutoutBounds.width) / 2;
            tryFit.above = true;
            if (!updatedBubblePosition(top, left)) return;
            const arrowTop = top + bubbleBounds.height;
            const arrowLeft = cutoutBounds.left + (cutoutBounds.width - margin) / 2;
            bubbleArrow.style.borderLeft = transparentBorder;
            bubbleArrow.style.borderRight = transparentBorder;
            bubbleArrow.style.borderTop = opaqueBorder;
            updatePosition(bubbleArrow, arrowTop, arrowLeft);
            bubbleArrowOutline.style.borderLeft = transparentOutline;
            bubbleArrowOutline.style.borderRight = transparentOutline;
            bubbleArrowOutline.style.borderTop = opaqueOutline;
            updatePosition(bubbleArrowOutline, arrowTop, arrowLeft - outlineOffset);
        }

        const positionBelow = () => {
            const top = cutoutBounds.bottom + margin;
            const left = cutoutBounds.left - (bubbleBounds.width - cutoutBounds.width) / 2;
            tryFit.below = true;
            if (!updatedBubblePosition(top, left)) return;
            const arrowTop = top - margin;
            const arrowLeft = cutoutBounds.left + (cutoutBounds.width - margin) / 2;
            bubbleArrow.style.borderLeft = transparentBorder;
            bubbleArrow.style.borderRight = transparentBorder;
            bubbleArrow.style.borderBottom = opaqueBorder;
            updatePosition(bubbleArrow, arrowTop, arrowLeft);
            bubbleArrowOutline.style.borderLeft = transparentOutline;
            bubbleArrowOutline.style.borderRight = transparentOutline;
            bubbleArrowOutline.style.borderBottom = opaqueOutline;
            updatePosition(bubbleArrowOutline, arrowTop - outlineOffset, arrowLeft - outlineOffset);
        }

        const positionLeft = () => {
            const top = cutoutBounds.top - (bubbleBounds.height - cutoutBounds.height) / 2;
            const left = cutoutBounds.left - bubbleBounds.width - margin;
            tryFit.left = true;
            if (!updatedBubblePosition(top, left)) return;
            const arrowTop = top + (bubbleBounds.height - margin) / 2;
            const arrowLeft = cutoutBounds.left - margin;
            bubbleArrow.style.borderLeft = opaqueBorder;
            bubbleArrow.style.borderTop = transparentBorder;
            bubbleArrow.style.borderBottom = transparentBorder;
            updatePosition(bubbleArrow, arrowTop, arrowLeft);
            bubbleArrowOutline.style.borderLeft = opaqueOutline;
            bubbleArrowOutline.style.borderTop = transparentOutline;
            bubbleArrowOutline.style.borderBottom = transparentOutline;
            updatePosition(bubbleArrowOutline, arrowTop - outlineOffset, arrowLeft);
        }

        const positionRight = () => {
            const top = cutoutBounds.top - (bubbleBounds.height - cutoutBounds.height) / 2;
            const left = cutoutBounds.right + margin;
            tryFit.right = true;
            if (!updatedBubblePosition(top, left)) return;
            const arrowTop = top + (bubbleBounds.height - margin) / 2;
            const arrowLeft = cutoutBounds.right;
            bubbleArrow.style.borderRight = opaqueBorder;
            bubbleArrow.style.borderTop = transparentBorder;
            bubbleArrow.style.borderBottom = transparentBorder;
            updatePosition(bubbleArrow, arrowTop, arrowLeft);
            bubbleArrowOutline.style.borderRight = opaqueOutline;
            bubbleArrowOutline.style.borderTop = transparentOutline;
            bubbleArrowOutline.style.borderBottom = transparentOutline;
            updatePosition(bubbleArrowOutline, arrowTop - outlineOffset, arrowLeft - outlineOffset);
        }

        const positionCenter = () => {
            const top = (cutoutBounds.height - bubbleBounds.height) / 2 + cutoutBounds.top;
            const left = (cutoutBounds.width - bubbleBounds.width) / 2 + cutoutBounds.left;
            updatedBubblePosition(top, left);
            // update arrow position to be centered and then transparent to improve animation appearance
            updatePosition(bubbleArrow, top + bubbleBounds.height / 2, left + bubbleBounds.width / 2);
            updatePosition(bubbleArrowOutline, top + bubbleBounds.height / 2, left + bubbleBounds.width / 2);
            bubbleArrowOutline.style.opacity = "0";
            bubbleArrow.style.opacity = "0";
        }

        const updatedBubblePosition = (top: number, left: number): boolean => {
            const [adjTop, adjLeft] = bubbleFits(cutoutBounds, bubbleBounds, top, left);
            if (adjTop && adjLeft) {
                updatePosition(bubble, adjTop, adjLeft);
            } else {
                reposition();
                return false;
            }
            return true;
        }

        const reposition = () => {
            if (!tryFit.above) {
                positionAbove();
            } else if (!tryFit.below) {
                positionBelow();
            } else if (!tryFit.left) {
                positionLeft();
            } else if (!tryFit.right) {
                positionRight();
            } else {
                positionCenterScreen(bubble, bubbleBounds);
            }
        }

        switch (targetContent.location) {
            case pxt.tour.BubbleLocation.Above:
                positionAbove();
                break;
            case pxt.tour.BubbleLocation.Below:
                positionBelow();
                break;
            case pxt.tour.BubbleLocation.Left:
                positionLeft();
                break;
            case pxt.tour.BubbleLocation.Right:
                positionRight();
                break;
            default:
                positionCenter();
        }
    }

    const bubbleFits = (cutoutBounds: CutoutBounds, bubbleBounds: DOMRect, top: number, left: number): [number, number] => {
        if (top < margin) top = margin;
        if (left < margin) left = margin;
        const right = left + bubbleBounds.width;
        const bottom = top + bubbleBounds.height;
        if (right < window.innerWidth - margin && bottom < window.innerHeight - margin) return [top, left];
        if (right > window.innerWidth) {
            left -= right - window.innerWidth + margin;
        }
        if (bottom > window.innerHeight) {
            top -= bottom - window.innerHeight + margin;
        }
        if (collision(cutoutBounds, bubbleBounds, top, left)) return [null, null];
        return [top, left];
    }

    const collision = (cutoutBounds: CutoutBounds, bubbleBounds: DOMRect, top?: number, left?: number): boolean => {
        const hCheck1 = (left ?? bubbleBounds.left) < cutoutBounds.left + cutoutBounds.width;
        const hCheck2 = (left ?? bubbleBounds.left) + bubbleBounds.width > cutoutBounds.left;
        const vCheck1 = (top ?? bubbleBounds.top) < cutoutBounds.top + cutoutBounds.height;
        const vCheck2 = (top ?? bubbleBounds.top) + bubbleBounds.height > cutoutBounds.top;
        return hCheck1 && hCheck2 && vCheck1 && vCheck2;
    }

    const positionCenterScreen = (bubble: HTMLElement, bubbleBounds: DOMRect) => {
        updatePosition(bubble, (window.innerHeight - bubbleBounds.height) / 2, (window.innerWidth - bubbleBounds.width) / 2);
    }

    const updatePosition = (element: HTMLElement, top: number, left: number) => {
        if (top < margin) top = margin;
        if (left < margin) left = margin;
        element.style.top = top + "px";
        element.style.left = left + "px";
    }

    const hasSteps = totalSteps > 1;
    const closeLabel = lf("Close");
    const backLabel = lf("Back");
    const nextLabel = lf("Next");
    const finishLabel = hasSteps ? lf("Finish") : lf("Got it");

    const classes = classList(
        "teaching-bubble-container",
        className,
        targetContent.bubbleStyle
    );

    return ReactDOM.createPortal(<FocusTrap className={classes} onEscape={onClose}>
        {props.showConfetti && <Confetti />}
        <div className="teaching-bubble-cutout" />
        <div className="teaching-bubble-arrow" />
        <div className="teaching-bubble-arrow-outline" />
        <div id={id}
            className="teaching-bubble"
            role={role || "dialog"}
            aria-hidden={ariaHidden}
            aria-label={ariaLabel}
            aria-describedby={ariaDescribedBy}
            aria-labelledby="teaching-bubble-title">
            <Button
                className="teaching-bubble-close"
                onClick={onClose}
                title={closeLabel}
                ariaLabel={closeLabel}
                rightIcon="fas fa-times-circle"
            />
            <div className="teaching-bubble-content">
                <strong aria-live="polite">{targetContent.title}</strong>
                <p aria-live="polite">{targetContent.description}</p>
                {targetContent.notice && <div className="teaching-bubble-notice" aria-live="polite">
                    <i className="fas fa-exclamation" />
                    <span className="notice-text">{targetContent.notice}</span>
                </div>}
                <div className={`teaching-bubble-footer ${!hasSteps ? "no-steps" : ""}`}>
                    {hasSteps && <div className={classList("teaching-bubble-steps", forceHideSteps ? "hidden" : undefined)} aria-live="polite">
                        {stepNumber} of {totalSteps}
                    </div>}
                    <div className="teaching-bubble-navigation">
                        {hasPrevious && <Button
                            className="tertiary tour-button"
                            onClick={onBack}
                            title={backLabel}
                            ariaLabel={backLabel}
                            label={backLabel}
                        />}
                        {hasNext && <Button
                            className="tertiary inverted teaching-bubble-button"
                            onClick={onNext}
                            title={nextLabel}
                            ariaLabel={nextLabel}
                            label={nextLabel}
                        />}
                        {!hasNext && <Button
                            className="tertiary inverted teaching-bubble-button"
                            onClick={onFinish}
                            title={finishLabel}
                            ariaLabel={finishLabel}
                            label={finishLabel}
                        />}
                    </div>
                </div>
            </div>
        </div>
    </FocusTrap>, parentElement || document.getElementById("root") || document.body)
}
