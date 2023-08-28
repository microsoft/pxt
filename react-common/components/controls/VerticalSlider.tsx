import * as React from "react";
import { classList, ControlProps } from "../util";

export interface VerticalSliderProps extends ControlProps {
    value: number;
    min: number;
    max: number;
    step: number;
    bigStep?: number;

    onValueChanged: (newValue: number) => void;

    ariaValueText: string | ((value: number) => string);
}

export const VerticalSlider = (props: VerticalSliderProps) => {
    const {
        value,
        min,
        max,
        step,
        bigStep,
        onValueChanged,
        id,
        className,
        role,
        ariaHidden,
        ariaLabel,
        ariaDescribedBy,
        ariaValueText,
    } = props;

    const [current, setCurrent] = React.useState(undefined);

    const wrapperRef = React.useRef<HTMLDivElement>();
    const railRef = React.useRef<HTMLDivElement>();
    const handleRef = React.useRef<HTMLDivElement>();

    const positionHandle = React.useCallback((v: number) => {
        const steps = ((max - min) / step);
        const bounds = railRef.current.getBoundingClientRect();
        const handleBounds = handleRef.current.getBoundingClientRect();

        const index = Math.round((v - min) / step);

        handleRef.current.style.top = (bounds.height / steps) * index - (handleBounds.height / 2) + "px";
    }, [handleRef.current, railRef.current, max, min, step])

    const onKeyDown = React.useCallback((e: React.KeyboardEvent) => {
        const changeValue = (newValue: number) => {
            newValue = Math.max(Math.min(newValue, max), min);
            if (newValue !== value) {
                positionHandle(newValue);
                onValueChanged(newValue);
            }
            e.preventDefault();
            e.stopPropagation();
        }
        if (e.key === "ArrowDown" || e.key === "ArrowRight") {
            changeValue(value + step);
        }
        else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
            changeValue(value - step);
        }
        else if (e.key === "PageDown") {
            changeValue(value + (bigStep || step * 4));
        }
        else if (e.key === "PageUp") {
            changeValue(value - (bigStep || step * 4));
        }
        else if (e.key === "Home") {
            changeValue(min);
        }
        else if (e.key === "End") {
            changeValue(max);
        }
    }, [value, min, max, onValueChanged, positionHandle]);

    React.useEffect(() => {
        let inGesture = false;
        const steps = ((max - min) / step);

        const updatePosition = (e: PointerEvent) => {
            if (!inGesture) return undefined;
            const bounds = railRef.current.getBoundingClientRect();
            const y = e.clientY - bounds.top;

            const percentage = Math.min(1, Math.max(y / bounds.height, 0));
            const index = Math.round(steps * percentage);
            const newValue = min + index * step;

            setCurrent(newValue);
            positionHandle(newValue);

            return newValue;
        };

        const onGestureEnd = (newValue: number) => {
            if (!inGesture) return;

            inGesture = false;

            onValueChanged(newValue);
            setCurrent(undefined);
        };

        const pointerdown = (e: PointerEvent) => {
            inGesture = true;
            updatePosition(e);
        };

        const pointerup = (e: PointerEvent) => {
            onGestureEnd(updatePosition(e));
        };

        const pointermove = (e: PointerEvent) => {
            updatePosition(e);
        };

        const pointerleave = (e: PointerEvent) => {
            onGestureEnd(updatePosition(e));
        };

        const container = wrapperRef.current;

        container.addEventListener("pointerdown", pointerdown);
        container.addEventListener("pointerup", pointerup);
        container.addEventListener("pointermove", pointermove);
        container.addEventListener("pointerleave", pointerleave);

        return () => {
            container.removeEventListener("pointerdown", pointerdown);
            container.removeEventListener("pointerup", pointerup);
            container.removeEventListener("pointermove", pointermove);
            container.removeEventListener("pointerleave", pointerleave);
        }
    }, [min, max, step, onValueChanged, positionHandle]);

    React.useEffect(() => {
        positionHandle(value);
    }, [value, positionHandle])

    let valueText: string;
    if (typeof ariaValueText === "string") {
        valueText = ariaValueText;
    }
    else {
        valueText = ariaValueText(current !== undefined ? current : value);
    }

    return (
        <div className={classList("common-vertical-slider-wrapper", className)} ref={wrapperRef}>
            <div className="common-vertical-slider-rail" ref={railRef} />
            <div
                id={id}
                className="common-vertical-slider-handle"
                tabIndex={0}
                role={role || "slider"}
                ref={handleRef}
                onKeyDown={onKeyDown}
                aria-label={ariaLabel}
                aria-hidden={ariaHidden}
                aria-describedby={ariaDescribedBy}
                aria-valuemin={min}
                aria-valuemax={max}
                aria-valuenow={value}
                aria-valuetext={valueText}
            />
        </div>
    );
}