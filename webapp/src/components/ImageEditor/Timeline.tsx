import * as React from "react";

import { TimelineFrame } from "./TimelineFrame";
import { bindGestureEvents, ClientCoordinates } from "./util";
import { Action, deleteFrame, duplicateFrame, ImageEditorContext, moveFrame, newFrame, AnimationState, changeCurrentFrame } from "./state";
import { classList } from "../../../../react-common/components/util";

interface DragState {
    scrollOffset: number;
    dragEnd: boolean;
    currentFrame: number;
    isMovingFrame: boolean;
    dispatch: (a: Action) => void;
    dropPreviewIndex?: number;
}

export const Timeline = () => {
    const { state, dispatch } = React.useContext(ImageEditorContext);
    const [isMovingFrame, setIsMovingFrame] = React.useState(false);
    const [dropPreviewIndex, setDropPreviewIndex] = React.useState<number>(null);

    const dragState = React.useRef<DragState>({ scrollOffset: 0, dragEnd: false, isMovingFrame, dropPreviewIndex, dispatch, currentFrame: 0 });
    const dragFrameRef = React.useRef<HTMLDivElement>();
    const scrollerRef = React.useRef<HTMLDivElement>();

    const { previewAnimating } = state.editor

    const editState = state.store.present as AnimationState;
    const { frames, currentFrame, interval, colors } = editState;

    let renderFrames = frames.slice();
    let dragFrame: pxt.sprite.ImageState;

    if (isMovingFrame) {
        dragFrame = frames[currentFrame];

        renderFrames.splice(currentFrame, 1);
        renderFrames.splice(dropPreviewIndex, 0, null)
    }

    const onNewFrameClick = React.useCallback(() => {
        dispatch(newFrame());
    }, [dispatch]);

    const onDuplicateFrameClick = React.useCallback(() => {
        dispatch(duplicateFrame(currentFrame));
    }, [currentFrame, dispatch]);

    const onDeleteFrameClick = React.useCallback(() => {
        dispatch(deleteFrame(currentFrame));
    }, [currentFrame, dispatch]);

    const onFrameSelected = React.useCallback((index: number) => {
        if (dragState.current.dragEnd) {
            dragState.current.dragEnd = false;
        }
        else if (index != currentFrame) {
            dispatch(changeCurrentFrame(index));
        }
    }, [dispatch, currentFrame])

    React.useEffect(() => {
        let last: number;
        let isScroll = false;

        const updateDragDrop = (coord: ClientCoordinates) => {
            const parent = scrollerRef.current.getBoundingClientRect();
            const scrollY = coord.clientY - parent.top;

            const unit = scrollerRef.current.firstElementChild.getBoundingClientRect().height;
            const index = Math.floor(scrollY / unit);

            if (!dragState.current.isMovingFrame) {
                setIsMovingFrame(true);
                setDropPreviewIndex(dragState.current.currentFrame);
            }
            else if (dragFrameRef.current) {
                dragFrameRef.current.style.top = scrollY + "px";
                    setDropPreviewIndex(index);
            }
        }

        bindGestureEvents(scrollerRef.current, {
            onClick: () => {
                dragState.current.dragEnd = false;
            },
            onDragStart: coord => {
                last = coord.clientY;
                pxt.BrowserUtils.addClass(scrollerRef.current, "scrolling");

                const parent = scrollerRef.current.getBoundingClientRect();
                const scrollY = coord.clientY - parent.top;

                const unit = scrollerRef.current.firstElementChild.getBoundingClientRect().height;
                const index = Math.floor(scrollY / unit);

                isScroll = index !== dragState.current.currentFrame;
            },
            onDragMove: coord => {
                if (isScroll) {
                    dragState.current.scrollOffset -= last - coord.clientY;
                    last = coord.clientY;

                    try {
                        const rect = scrollerRef.current.getBoundingClientRect();
                        const parent = scrollerRef.current.parentElement.getBoundingClientRect();

                        if (rect.height > parent.height) {
                            dragState.current.scrollOffset = Math.max(Math.min(dragState.current.scrollOffset, 0), parent.height - rect.height - 15);
                        }
                        else {
                            dragState.current.scrollOffset = 0;
                        }
                        scrollerRef.current.parentElement.scrollTop = -dragState.current.scrollOffset;
                    }
                    catch (e) {
                        // Some browsers throw if you get the bounds while not in the dom. Ignore it.
                    }
                }
                else {
                    updateDragDrop(coord);
                }
            },
            onDragEnd: () => {
                last = null;
                pxt.BrowserUtils.removeClass(scrollerRef.current, "scrolling");
                dragState.current.dragEnd = true;

                if (dragState.current.isMovingFrame) {
                    const { dispatch, currentFrame } = dragState.current;

                    dispatch(moveFrame(currentFrame, dragState.current.dropPreviewIndex));
                    setIsMovingFrame(false);
                }
            },
        });

        scrollerRef.current.addEventListener("wheel", ev => {
            dragState.current.scrollOffset -= ev.deltaY

            try {
                const rect = scrollerRef.current.getBoundingClientRect();
                const parent = scrollerRef.current.parentElement.getBoundingClientRect();

                if (rect.height > parent.height) {
                    dragState.current.scrollOffset = Math.max(Math.min(dragState.current.scrollOffset, 0), parent.height - rect.height - 15);
                }
                else {
                    dragState.current.scrollOffset = 0;
                }
                scrollerRef.current.parentElement.scrollTop = -dragState.current.scrollOffset;
            }
            catch (e) {
                // Some browsers throw if you get the bounds while not in the dom. Ignore it.
            }
        });
    });

    // FIXME: Obviously this is a little cursed, need to refactor how
    // we do drag and drop behavior so that it doesn't need these values
    // passed through. Can't pass them in the use effect dependencies because
    // doing so will break the drag state if the state is changed while
    // a drag is happening.
    dragState.current.isMovingFrame = isMovingFrame;
    dragState.current.currentFrame = currentFrame;
    dragState.current.dropPreviewIndex = dropPreviewIndex;
    dragState.current.dispatch = dispatch;

    return (
        <div className={`image-editor-timeline ${pxt.BrowserUtils.isEdge() ? 'edge' : ''}`}>
            <div className="image-editor-timeline-preview" >
                <TimelineFrame
                    frames={previewAnimating ? frames : [frames[currentFrame]]}
                    colors={colors} interval={interval}
                    animating={true}
                />
            </div>
            <div className="image-editor-timeline-frames-outer">
                <div className="image-editor-timeline-frames" ref="frame-scroller-ref">
                    {renderFrames.map((frame, index) => {
                        const isActive = !isMovingFrame && index === currentFrame;
                        if (!frame) {
                            return (
                                <div
                                    key={index}
                                    className="image-editor-timeline-frame drop-marker"
                                />
                            );
                        }

                        return (
                            <div
                                key={index}
                                role="button"
                                className={classList("image-editor-timeline-frame", isActive && "active")}
                                onClick={() => onFrameSelected(index)}
                            >
                                <TimelineFrame
                                    frames={[frame]}
                                    colors={colors}
                                    showActions={isActive}
                                    duplicateFrame={onDuplicateFrameClick}
                                    deleteFrame={onDeleteFrameClick}
                                />
                            </div>
                        );
                    })}
                    {dragFrame &&
                        <div ref="floating-frame" className="image-editor-timeline-frame dragging">
                            <TimelineFrame
                                frames={[dragFrame]}
                                colors={colors}
                                duplicateFrame={onDuplicateFrameClick}
                                deleteFrame={onDeleteFrameClick}
                            />
                        </div>
                    }
                    <div className="image-editor-timeline-frame collapsed" role="button" onClick={onNewFrameClick}>
                        <span className="ms-Icon ms-Icon--Add" />
                    </div>
                </div>
            </div>
        </div>
    );
}
