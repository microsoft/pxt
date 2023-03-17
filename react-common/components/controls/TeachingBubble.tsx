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
            // display bubble in center of screen
            updatePosition(bubble, (window.innerHeight - bubbleBounds.height) / 2, (window.innerWidth - bubbleBounds.width) / 2);
            clearCutout();
            return;
        }
        const targetBounds = targetElement.getBoundingClientRect();
        setPosition(targetBounds, bubble, bubbleBounds, bubbleArrow);
        setCutout(targetBounds, targetElement);
    }

    const setCutout = (targetBounds: DOMRect, targetElement: HTMLElement) => {
        const cutout = document.querySelector(".teaching-bubble-cutout") as HTMLElement;
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
        cutout.style.top = `${cutoutTop}px`;
        cutout.style.left = `${cutoutLeft}px`;
        cutout.style.width = `${cutoutWidth}px`;
        cutout.style.height = `${cutoutHeight}px`;

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

    const setPosition = (targetBounds: DOMRect, bubble: HTMLElement, bubbleBounds: DOMRect, bubbleArrow: HTMLElement) => {
        const transparentBorder = `${margin}px solid transparent`;
        const opaqueBorder = `${margin}px solid`;

        const positionAbove = () => {
            const top = targetBounds.top - bubbleBounds.height - margin;
            const left = targetBounds.left - (bubbleBounds.width - targetBounds.width) / 2;
            const arrowTop = top + bubbleBounds.height;
            const arrowLeft = targetBounds.left + (targetBounds.width - margin) / 2;
            bubbleArrow.style.borderLeft = transparentBorder;
            bubbleArrow.style.borderRight = transparentBorder;
            bubbleArrow.style.borderTop = opaqueBorder;
            checkAndUpdatePosition(bubble, top, left, bubbleArrow, arrowTop, arrowLeft);
        }

        const positionBelow = () => {
            const top = targetBounds.bottom + margin;
            const left = targetBounds.left - (bubbleBounds.width - targetBounds.width) / 2;
            const arrowTop = top - margin;
            const arrowLeft = targetBounds.left + (targetBounds.width - margin) / 2;
            bubbleArrow.style.borderLeft = transparentBorder;
            bubbleArrow.style.borderRight = transparentBorder;
            bubbleArrow.style.borderBottom = opaqueBorder;
            checkAndUpdatePosition(bubble, top, left, bubbleArrow, arrowTop, arrowLeft);
        }

        const positionLeft = () => {
            const top = targetBounds.top - (bubbleBounds.height - targetBounds.height) / 2;
            const left = targetBounds.left - margin;
            const arrowTop = top + (bubbleBounds.height - margin) / 2;
            const arrowLeft = targetBounds.left - margin;
            bubbleArrow.style.borderLeft = opaqueBorder;
            bubbleArrow.style.borderTop = transparentBorder;
            bubbleArrow.style.borderBottom = transparentBorder;
            checkAndUpdatePosition(bubble, top, left, bubbleArrow, arrowTop, arrowLeft);
        }

        const positionRight = () => {
            const top = targetBounds.top - (bubbleBounds.height - targetBounds.height) / 2;
            const left = targetBounds.right + margin;
            const arrowTop = top + (bubbleBounds.height - margin) / 2;
            const arrowLeft = targetBounds.right;
            bubbleArrow.style.borderRight = opaqueBorder;
            bubbleArrow.style.borderTop = transparentBorder;
            bubbleArrow.style.borderBottom = transparentBorder;
            checkAndUpdatePosition(bubble, top, left, bubbleArrow, arrowTop, arrowLeft);
        }

        const positionCenter = () => {
            const top = (targetBounds.height - bubbleBounds.height) / 2 + targetBounds.top;
            const left = (targetBounds.width - bubbleBounds.width) / 2 + targetBounds.left;
            checkAndUpdatePosition(bubble, top, left);
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

    const checkAndUpdatePosition = (bubble: HTMLElement, top: number, left: number, bubbleArrow?: HTMLElement, arrowTop?: number, arrowLeft?: number) => {
        if (top < 10) top = 10;
        if (left < 10) left = 10;
        updatePosition(bubble, top, left);
        if (!bubbleArrow || !arrowTop || !arrowLeft) return;
        updatePosition(bubbleArrow, arrowTop, arrowLeft);
    }

    const updatePosition = (element: HTMLElement, top: number, left: number) => {
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
    const inHighContrastMode = document.getElementById("root").classList.contains("hc");

    const classes = classList(
        "teaching-bubble-container",
        className,
        inHighContrastMode ? "hc" : ""
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
    </FocusTrap>, parentElement || document.body)
}
