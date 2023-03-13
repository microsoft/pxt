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
    const transparentBorder = `${margin}px solid transparent`;
    const opaqueBorder = `${margin}px solid`;
    let bubble: HTMLElement;
    let bubbleArrow: HTMLElement;
    let bubbleBounds: DOMRect;
    let targetElement: HTMLElement;
    let targetBounds: DOMRect;
    let top: number;
    let left: number;
    let arrowTop: number;
    let arrowLeft: number;

    useEffect(() => {
        positionBubbleAndCutout();
        window.addEventListener("resize", positionBubbleAndCutout);
        return () => {
            window.removeEventListener("resize", positionBubbleAndCutout);
        }
    }, [stepNumber]);

    useEffect(() => {
        if (!hasSteps) {
            const footer = document.querySelector(".teaching-bubble-footer") as HTMLElement;
            footer.style.flexDirection = "row-reverse";
        }
    }, []);

    const positionBubbleAndCutout = () => {
        bubble = document.getElementById(id);
        bubbleArrow = document.querySelector(".teaching-bubble-arrow") as HTMLElement;
        bubbleArrow.style.border = "none";
        bubbleBounds = bubble.getBoundingClientRect();
        // To Do: check that targetContent.targetQuery is a valid selector
        targetElement = document.querySelector(targetContent.targetQuery) as HTMLElement;
        if (!targetElement) {
            // display bubble in center of screen
            updatePosition(bubble, `${(window.innerHeight - bubbleBounds.height) / 2}px`, `${(window.innerWidth - bubbleBounds.width) / 2}px`);
            clearCutout();
            return;
        }
        targetBounds = targetElement.getBoundingClientRect();
        setPosition();
        setCutout();
    }

    const setCutout = () => {
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

    const setPosition = () => {
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
        if (top < 10) top = 10;
        if (left < 10) left = 10;
        updatePosition(bubble, top + "px", left + "px");
        updatePosition(bubbleArrow, arrowTop + "px", arrowLeft + "px");
    }

    const positionAbove = () => {
        top = targetBounds.top - bubbleBounds.height - margin;
        left = targetBounds.left - (bubbleBounds.width - targetBounds.width) / 2;
        arrowTop = top + bubbleBounds.height;
        arrowLeft = targetBounds.left + (targetBounds.width - margin) / 2;
        bubbleArrow.style.borderLeft = transparentBorder;
        bubbleArrow.style.borderRight = transparentBorder;
        bubbleArrow.style.borderTop = opaqueBorder;
    }

    const positionBelow = () => {
        top = targetBounds.bottom + margin;
        left = targetBounds.left - (bubbleBounds.width - targetBounds.width) / 2;
        arrowTop = top - margin;
        arrowLeft = targetBounds.left + (targetBounds.width - margin) / 2;
        bubbleArrow.style.borderLeft = transparentBorder;
        bubbleArrow.style.borderRight = transparentBorder;
        bubbleArrow.style.borderBottom = opaqueBorder;
    }

    const positionLeft = () => {
        top = targetBounds.top - (bubbleBounds.height - targetBounds.height) / 2;
        left = targetBounds.left - margin;
        arrowTop = top + (bubbleBounds.height - margin) / 2;
        arrowLeft = targetBounds.left - margin;
        bubbleArrow.style.borderLeft = opaqueBorder;
        bubbleArrow.style.borderTop = transparentBorder;
        bubbleArrow.style.borderBottom = transparentBorder;
    }

    const positionRight = () => {
        top = targetBounds.top - (bubbleBounds.height - targetBounds.height) / 2;
        left = targetBounds.right + margin;
        arrowTop = top + (bubbleBounds.height - margin) / 2;
        arrowLeft = targetBounds.right;
        bubbleArrow.style.borderRight = opaqueBorder;
        bubbleArrow.style.borderTop = transparentBorder;
        bubbleArrow.style.borderBottom = transparentBorder;
    }

    const positionCenter = () => {
        top = (targetBounds.height - bubbleBounds.height) / 2 + targetBounds.top;
        left = (targetBounds.width - bubbleBounds.width) / 2 + targetBounds.left;
    }

    const updatePosition = (element: HTMLElement, top: string, left: string) => {
        element.style.top = top;
        element.style.left = left;
    }

    const closeLabel = lf("Close");
    const backLabel = lf("Back");
    const nextLabel = lf("Next");
    const confirmLabel = lf("Got it");
    const finishLabel = lf("Finish");
    const hasPrevious = stepNumber > 1;
    const hasNext = stepNumber < totalSteps;
    const hasSteps = totalSteps > 1;

    const classes = classList(
        "teaching-bubble-container",
        className
    );

    return ReactDOM.createPortal(<FocusTrap className={classes} onEscape={onClose}>
        <div className="teaching-bubble-cutout"></div>
        <div className="teaching-bubble-arrow"></div>
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
                {hasSteps && <div className="teaching-bubble-footer">
                    {stepNumber && totalSteps && <div className="teaching-bubble-steps">
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
                </div>}
                {(!hasSteps) && <div className="teaching-bubble-footer">
                    <Button
                        className="primary-button"
                        onClick={onClose}
                        title={confirmLabel}
                        ariaLabel={confirmLabel}
                        label={confirmLabel}
                    />
                </div>}
            </div>
        </div>
    </FocusTrap>, parentElement || document.body)
}
