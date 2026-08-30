import * as React from "react";

interface Props {
    horizontal?: boolean;
}

export const Scrollbar = (props: Props) => {
    const { horizontal } = props;
    const scrollbarRef = React.useRef<HTMLDivElement>(null);
    const thumbRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        const scrollbar = scrollbarRef.current;
        const container = scrollbar.parentElement;
        const thumb = thumbRef.current;

        if (!scrollbar || !container || !thumb) return () => {};

        let updateThumb = () => {
            const containerSize = horizontal ? container.clientWidth : container.clientHeight;
            const contentSize = horizontal ? container.scrollWidth : container.scrollHeight;

            if (contentSize <= containerSize) {
                scrollbar.style.display = "none";
                return;
            }
            else {
                scrollbar.style.display = "block";
            }

            const thumbSize = Math.max((containerSize / contentSize) * containerSize, 20);
            const thumbPosition = (horizontal ? container.scrollLeft : container.scrollTop) / (contentSize - containerSize) * (containerSize - thumbSize - 16) + 8;
            if (horizontal) {
                thumb.style.width = `${thumbSize}px`;
                thumb.style.transform = `translateX(${thumbPosition}px)`;
            } else {
                thumb.style.height = `${thumbSize}px`;
                thumb.style.transform = `translateY(${thumbPosition}px)`;
            }
        };

        updateThumb();
        requestAnimationFrame(updateThumb);
        container.addEventListener("scroll", updateThumb);
        window.addEventListener("resize", updateThumb);

        let dragging = false;
        let dragStart = 0;
        let scrollStart = 0;

        const onPointerDownThumb = (e: PointerEvent) => {
            e.preventDefault();
            dragging = true;
            dragStart = horizontal ? e.clientX : e.clientY;
            scrollStart = horizontal ? container.scrollLeft : container.scrollTop;
            document.addEventListener("pointermove", onPointerMoveThumb);
            document.addEventListener("pointerup", onPointerUpThumb);
        }

        const onPointerMoveThumb = (e: PointerEvent) => {
            if (!dragging) return;
            e.preventDefault();

            const delta = (horizontal ? e.clientX : e.clientY) - dragStart;
            const containerSize = horizontal ? container.clientWidth : container.clientHeight;
            const contentSize = horizontal ? container.scrollWidth : container.scrollHeight;
            const thumbSize = horizontal ? thumb.offsetWidth : thumb.offsetHeight;
            const scrollDelta = delta * (contentSize - containerSize) / (containerSize - thumbSize - 16);
            if (horizontal) {
                container.scrollLeft = scrollStart + scrollDelta;
            } else {
                container.scrollTop = scrollStart + scrollDelta;
            }
        }

        const onPointerUpThumb = (e: PointerEvent) => {
            dragging = false;
            document.removeEventListener("pointermove", onPointerMoveThumb);
            document.removeEventListener("pointerup", onPointerUpThumb);
        }

        thumb.addEventListener("pointerdown", onPointerDownThumb);

        const onPointerDown = (e: PointerEvent) => {
            e.preventDefault();
            const rect = scrollbar.getBoundingClientRect();
            const clickPosition = horizontal ? e.clientX - rect.left : e.clientY - rect.top;
            const containerSize = horizontal ? container.clientWidth : container.clientHeight;
            const contentSize = horizontal ? container.scrollWidth : container.scrollHeight;
            const thumbSize = horizontal ? thumb.offsetWidth : thumb.offsetHeight;
            const thumbPosition = (horizontal ? container.scrollLeft : container.scrollTop) / (contentSize - containerSize) * (containerSize - thumbSize - 16) + 8;

            if (clickPosition < thumbPosition) {
                if (horizontal) {
                    container.scrollLeft -= containerSize;
                } else {
                    container.scrollTop -= containerSize;
                }
            }
            else if (clickPosition > thumbPosition + thumbSize) {
                if (horizontal) {
                    container.scrollLeft += containerSize;
                } else {
                    container.scrollTop += containerSize;
                }
            }

            onPointerDownThumb(e);
        }

        scrollbar.addEventListener("pointerdown", onPointerDown);

        const mutationObserver = new MutationObserver(updateThumb);
        mutationObserver.observe(container, { childList: true, subtree: true });

        const resizeObserver = new ResizeObserver(updateThumb);
        resizeObserver.observe(container);

        return () => {
            scrollbar.removeEventListener("pointerdown", onPointerDown);
            thumb.removeEventListener("pointerdown", onPointerDownThumb);
            document.removeEventListener("pointermove", onPointerMoveThumb);
            document.removeEventListener("pointerup", onPointerUpThumb);
            container.removeEventListener("scroll", updateThumb);
            window.removeEventListener("resize", updateThumb);
            mutationObserver.disconnect();
            resizeObserver.disconnect();
        };
    }, [horizontal]);

    const onClick = (e: React.MouseEvent<HTMLDivElement>) => {

    };

    return (
        <div ref={scrollbarRef} className={`scrollbar ${horizontal ? "horizontal" : "vertical"}`}>
            <div ref={thumbRef} className="scrollbar-thumb" />
        </div>
    );
}