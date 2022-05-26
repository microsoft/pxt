import * as React from "react";
import { ControlProps } from "../util";

export interface LazyImageProps extends ControlProps {
    src: string;
    alt: string;
    title?: string;
}

let observer: IntersectionObserver;

export const LazyImage = (props: LazyImageProps) => {
    const {
        id,
        className,
        role,
        src,
        alt,
        title,
        ariaLabel,
        ariaHidden,
        ariaDescribedBy,
    } = props;

    initObserver();

    let imageRef: HTMLImageElement;

    const handleImageRef = (ref: HTMLImageElement) => {
        if (!ref) return;

        if (imageRef) observer.unobserve(imageRef);
        imageRef = ref;
        observer.observe(ref);
    }



    return <div className="common-lazy-image-wrapper">
        <img
            id={id}
            ref={handleImageRef}
            className={className}
            data-src={src}
            alt={alt}
            title={title}
            role={role}
            aria-label={ariaLabel}
            aria-hidden={ariaHidden}
            aria-describedby={ariaDescribedBy}
        />
        <div className="common-spinner" />
    </div>
}

function initObserver() {
    if (observer) return;

    const config = {
        // If the image gets within 50px in the Y axis, start the download.
        rootMargin: '50px 0px',
        threshold: 0.01
    };
    const onIntersection: IntersectionObserverCallback = (entries) => {
        entries.forEach(entry => {
            // Are we in viewport?
            if (entry.intersectionRatio > 0) {
                // Stop watching and load the image
                observer.unobserve(entry.target);
                const url = entry.target.getAttribute("data-src");
                (entry.target as HTMLImageElement).src = url;

                const image = entry.target as HTMLImageElement;
                image.src = url;
                image.onload = () => {
                    image.parentElement.classList.add("loaded");
                }
            }
        })
    }
    observer = new IntersectionObserver(onIntersection, config);
}