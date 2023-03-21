import * as React from "react";
import * as ReactDOM from "react-dom";
import { Button } from "./Button";
import { ContainerProps, classList } from "../util";
import { FocusTrap } from "./FocusTrap";
import { useEffect } from "react";

export enum Location {
    Above,
    Below,
    Left,
    Right,
    Center
}

export interface CutoutBounds {
    top: number;
    bottom: number;
    left: number;
    right: number;
    width: number;
    height: number;
}

export interface TargetContent {
    title: string;
    description: string;
    targetQuery: string;
    location: Location;
}

export interface TeachingBubbleProps extends ContainerProps {
    targetContent: TargetContent;
    stepNumber: number;
    totalSteps: number;
    onClose: () => void;
    parentElement?: Element;
    activeTarget?: boolean; // if true, the target is clickable
    onNext: () => void;
    onBack: () => void;
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
        stepNumber,
        totalSteps,
        parentElement,
        activeTarget
    } = props;

    const margin = 10;
    const tryFit = {
        above: false,
        below: false,
        left: false,
        right: false
    }

    useEffect(() => {
        positionBubbleAndCutout();
        window.addEventListener("resize", positionBubbleAndCutout);
        return () => {
            window.removeEventListener("resize", positionBubbleAndCutout);
        }
    }, [stepNumber]);

    const positionBubbleAndCutout = () => {
        const bubble = document.getElementById(id);
        const bubbleArrow = document.querySelector(".teaching-bubble-arrow") as HTMLElement;
        bubbleArrow.style.border = "none";
        const bubbleBounds = bubble.getBoundingClientRect();
        // To Do: check that targetContent.targetQuery is a valid selector
        const targetElement = document.querySelector(targetContent.targetQuery) as HTMLElement;
        if (!targetElement) {
            positionCenterScreen(bubble, bubbleBounds);
            clearCutout();
            return;
        }
        const targetBounds = targetElement.getBoundingClientRect();
        const cutoutBounds = getCutoutBounds(targetBounds, targetElement);
        setCutout(cutoutBounds);
        setPosition(cutoutBounds, bubble, bubbleBounds, bubbleArrow);

    }

    const getCutoutBounds = (targetBounds: DOMRect, targetElement: HTMLElement): CutoutBounds => {
        let cutoutTop = targetBounds.top;
        let cutoutLeft = targetBounds.left;
        let cutoutWidth = targetBounds.width;
        let cutoutHeight = targetBounds.height;
        // make cutout bigger if no padding and not centered
        if (targetContent.location !== Location.Center) {
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
        cutout.style.left = `${cutoutBounds.left}px`;
        cutout.style.width = `${cutoutBounds.width}px`;
        cutout.style.height = `${cutoutBounds.height}px`;

        if (activeTarget) {
            cutout.style.pointerEvents = "none";
        }
    }

    const clearCutout = () => {
        const cutout = document.querySelector(".teaching-bubble-cutout") as HTMLElement;
        cutout.style.top = "0px";
        cutout.style.left = "0px";
        cutout.style.width = "0px";
        cutout.style.height = "0px";
    }

    const resetTryFit = () => {
        tryFit.above = false;
        tryFit.below = false;
        tryFit.left = false;
        tryFit.right = false;
    }

    const setPosition = (cutoutBounds: CutoutBounds, bubble: HTMLElement, bubbleBounds: DOMRect, bubbleArrow: HTMLElement) => {
        resetTryFit();
        const transparentBorder = `${margin}px solid transparent`;
        const opaqueBorder = `${margin}px solid`;

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
        }

        const positionCenter = () => {
            const top = (cutoutBounds.height - bubbleBounds.height) / 2 + cutoutBounds.top;
            const left = (cutoutBounds.width - bubbleBounds.width) / 2 + cutoutBounds.left;
            updatedBubblePosition(top, left);
        }

        const updatedBubblePosition = (top: number, left: number): boolean => {
            if (bubbleFits(bubbleBounds, top, left)) {
                updatePosition(bubble, top, left);
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
            case Location.Above:
                positionAbove();
                break;
            case Location.Below:
                positionBelow();
                break;
            case Location.Left:
                positionLeft();
                break;
            case Location.Right:
                positionRight();
                break;
            default:
                positionCenter();
        }
    }

    const bubbleFits = (bubbleBounds: DOMRect, top: number, left: number): boolean => {
        if (top < margin) top = margin;
        if (left < margin) left = margin;
        const right = left + bubbleBounds.width;
        const bottom = top + bubbleBounds.height;
        return right < window.innerWidth && bottom < window.innerHeight;
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

    const hasPrevious = stepNumber > 1;
    const hasNext = stepNumber < totalSteps;
    const hasSteps = totalSteps > 1;
    const closeLabel = lf("Close");
    const backLabel = lf("Back");
    const nextLabel = lf("Next");
    const finishLabel = hasSteps ? lf("Finish") : lf("Got it");

    const classes = classList(
        "teaching-bubble-container",
        className
    );

    return ReactDOM.createPortal(<FocusTrap className={classes} onEscape={onClose}>
        <div className="teaching-bubble-cutout" />
        <div className="teaching-bubble-arrow" />
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
                <strong>{targetContent.title}</strong>
                <p>{targetContent.description}</p>
                <div className={`teaching-bubble-footer ${!hasSteps ? "no-steps" : ""}`}>
                    {hasSteps && <div className="teaching-bubble-steps">
                        {stepNumber} of {totalSteps}
                    </div>}
                    <div className="teaching-bubble-navigation">
                        {hasPrevious && <Button
                            className="secondary-button"
                            onClick={onBack}
                            title={backLabel}
                            ariaLabel={backLabel}
                            label={backLabel}
                        />}
                        {hasNext && <Button
                            className="primary-button"
                            onClick={onNext}
                            title={nextLabel}
                            ariaLabel={nextLabel}
                            label={nextLabel}
                        />}
                        {!hasNext && <Button
                            className="primary-button"
                            onClick={onClose}
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
