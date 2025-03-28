import * as React from "react";
import { connect } from "react-redux";

import { ImageEditorStore, AnimationState } from "./store/imageReducer";
import { dispatchChangeCurrentFrame, dispatchNewFrame, dispatchDuplicateFrame, dispatchDeleteFrame, dispatchMoveFrame } from "./actions/dispatch";

import { TimelineFrame } from "./TimelineFrame";
import { bindGestureEvents, ClientCoordinates } from "./util";
import { Button } from "../../../../react-common/components/controls/Button";

interface TimelineProps {
    colors: string[];
    frames: pxt.sprite.ImageState[];
    currentFrame: number;
    interval: number;
    previewAnimating: boolean;

    dispatchChangeCurrentFrame: (index: number) => void;
    dispatchNewFrame: () => void;
    dispatchDuplicateFrame: (index: number) => void;
    dispatchDeleteFrame: (index: number) => void;
    dispatchMoveFrame: (oldIndex: number, newIndex: number) => void;
}

interface TimelineState {
    isMovingFrame?: boolean;
    dropPreviewIndex?: number;
}

export class TimelineImpl extends React.Component<TimelineProps, TimelineState> {
    protected handlers: (() => void)[] = [];
    protected frameScroller: HTMLDivElement;
    protected scrollOffset = 0;
    protected dragEnd = false;
    protected animHandler: any;
    protected lastTimestamp: number;

    constructor(props: TimelineProps) {
        super(props);
        this.state = {};
    }

    render() {
        const { frames, colors, currentFrame, interval, previewAnimating } = this.props;
        const { isMovingFrame, dropPreviewIndex } = this.state;

        let renderFrames = frames.slice();
        let dragFrame: pxt.sprite.ImageState;

        if (isMovingFrame) {
            dragFrame = frames[currentFrame];

            renderFrames.splice(currentFrame, 1);
            renderFrames.splice(dropPreviewIndex, 0, null)
        }

        return (
            <div className={`image-editor-timeline ${pxt.BrowserUtils.isEdge() ? 'edge' : ''}`}>
                <div className="image-editor-timeline-preview" >
                    <TimelineFrame frames={previewAnimating ? frames : [frames[currentFrame]]} colors={colors} interval={interval} animating={true} />
                </div>
                <div className="image-editor-timeline-frames-outer">
                    <div className="image-editor-timeline-frames" ref="frame-scroller-ref">
                        { renderFrames.map((frame, index) => {
                                const isActive = !isMovingFrame && index === currentFrame;
                                if (!frame) return <div className="image-editor-timeline-frame drop-marker" key={index} />

                                return <div className={`image-editor-timeline-frame ${isActive ? "active" : ""}`} key={index} role="button" onClick={this.clickHandler(index)}>
                                    <TimelineFrame
                                        frames={[frame]}
                                        colors={colors}
                                        showActions={isActive}
                                        duplicateFrame={this.duplicateFrame}
                                        deleteFrame={this.deleteFrame} />
                                </div>
                            }
                        ) }
                        { dragFrame &&
                            <div ref="floating-frame" className="image-editor-timeline-frame dragging">
                                <TimelineFrame
                                    frames={[dragFrame]}
                                    colors={colors}
                                    duplicateFrame={this.duplicateFrame}
                                    deleteFrame={this.deleteFrame} />
                            </div>
                        }
                        <Button
                            className="image-editor-button add-frame-button toggle"
                            title={lf("Add new frame")}
                            onClick={this.newFrame}
                            leftIcon="ms-Icon ms-Icon--Add"
                        />
                    </div>
                </div>
            </div>
        );
    }

    componentDidMount() {
        this.frameScroller = this.refs["frame-scroller-ref"] as HTMLDivElement;

        let last: number;
        let isScroll = false;
        let offsetY = 0;
        bindGestureEvents(this.frameScroller, {
            onClick: coord => {
                this.dragEnd = false;
            },
            onDragStart: coord => {
                last = coord.clientY;
                pxt.BrowserUtils.addClass(this.frameScroller, "scrolling");

                let index = -1;

                for (let i = 0; i < this.frameScroller.childElementCount; i++) {
                    const el = this.frameScroller.children.item(i);

                    const rect = el.getBoundingClientRect();
                    if (coord.clientY >= rect.top && coord.clientY <= rect.bottom) {
                        index = i;
                        offsetY = coord.clientY - rect.top;
                        break;
                    }
                }

                isScroll = index !== this.props.currentFrame;
            },
            onDragMove: coord => {
                if (isScroll) {
                    this.scrollOffset -= last - coord.clientY;
                    last = coord.clientY;

                    try {
                        const rect = this.frameScroller.getBoundingClientRect();
                        const parent = this.frameScroller.parentElement.getBoundingClientRect();

                        if (rect.height > parent.height) {
                            this.scrollOffset = Math.max(Math.min(this.scrollOffset, 0), parent.height - rect.height - 15);
                        }
                        else {
                            this.scrollOffset = 0;
                        }
                        this.frameScroller.parentElement.scrollTop = -this.scrollOffset;
                    }
                    catch (e) {
                        // Some browsers throw if you get the bounds while not in the dom. Ignore it.
                    }
                }
                else {
                    this.updateDragDrop(coord, offsetY);
                }
            },
            onDragEnd: () => {
                last = null;
                pxt.BrowserUtils.removeClass(this.frameScroller, "scrolling");
                this.dragEnd = true;

                if (this.state.isMovingFrame) {
                    const { dispatchMoveFrame, currentFrame } = this.props;

                    dispatchMoveFrame(currentFrame, this.state.dropPreviewIndex);

                    this.setState({
                        isMovingFrame: false
                    });
                }
            },
        });

        this.frameScroller.addEventListener("wheel", ev => {
            this.scrollOffset -= ev.deltaY

            try {
                const rect = this.frameScroller.getBoundingClientRect();
                const parent = this.frameScroller.parentElement.getBoundingClientRect();

                if (rect.height > parent.height) {
                    this.scrollOffset = Math.max(Math.min(this.scrollOffset, 0), parent.height - rect.height - 15);
                }
                else {
                    this.scrollOffset = 0;
                }
                this.frameScroller.parentElement.scrollTop = -this.scrollOffset;
            }
            catch (e) {
                // Some browsers throw if you get the bounds while not in the dom. Ignore it.
            }
        });
    }

    protected clickHandler(index: number) {
        if (!this.handlers[index]) this.handlers[index] = () => {
            const { currentFrame, dispatchChangeCurrentFrame } = this.props;
            if (this.dragEnd) this.dragEnd = false;
            else if (index != currentFrame) dispatchChangeCurrentFrame(index);
        };

        return this.handlers[index];
    }

    protected duplicateFrame = () => {
        const { currentFrame, dispatchDuplicateFrame } = this.props;
        dispatchDuplicateFrame(currentFrame);
    }

    protected deleteFrame = () => {
        const { currentFrame, dispatchDeleteFrame } = this.props;
        dispatchDeleteFrame(currentFrame);
    }

    protected newFrame = () => {
        const { dispatchNewFrame } = this.props;
        if (this.dragEnd) this.dragEnd = false;
        else dispatchNewFrame();
    }

    protected updateDragDrop(coord: ClientCoordinates, offsetY: number) {
        if (this.animHandler) {
            cancelAnimationFrame(this.animHandler);
            this.animHandler = undefined;
        }
        else {
            this.lastTimestamp = undefined;
        }

        const parent = this.frameScroller.getBoundingClientRect();
        const scrollY = coord.clientY - parent.top - offsetY;

        const buttonBBox = this.frameScroller.lastElementChild.getBoundingClientRect().height
        const unit = (parent.height - buttonBBox) / this.props.frames.length;
        const index = Math.floor(scrollY / unit);

        const SCROLL_RANGE = 80;
        const MIN_SPEED_DY = 100;
        const MAX_SPEED_DY = 500;

        const container = this.frameScroller.parentElement.getBoundingClientRect();
        const maxScroll = parent.height - container.height;

        if (maxScroll > 0) {
            if (Math.abs(container.top - coord.clientY) < SCROLL_RANGE) {
                this.animHandler = requestAnimationFrame(timestamp => {
                    if (!this.state.isMovingFrame || this.frameScroller.parentElement.scrollTop <= 0) return;

                    const dt = timestamp - (this.lastTimestamp || timestamp);
                    this.lastTimestamp = timestamp;

                    const scale = 1 - (Math.abs(container.top - coord.clientY) / SCROLL_RANGE);

                    const dy = (MIN_SPEED_DY + scale * (MAX_SPEED_DY - MIN_SPEED_DY)) * (dt / 1000);
                    this.frameScroller.parentElement.scrollTop = Math.max(0, this.frameScroller.parentElement.scrollTop - dy);
                    this.updateDragDrop(coord, offsetY);
                });
            }
            else if (Math.abs(container.bottom - coord.clientY) < SCROLL_RANGE) {
                this.animHandler = requestAnimationFrame(timestamp => {
                    if (!this.state.isMovingFrame || this.frameScroller.parentElement.scrollTop >= maxScroll) return;

                    const dt = timestamp - (this.lastTimestamp || timestamp);
                    this.lastTimestamp = timestamp;

                    const scale = 1 - (Math.abs(container.bottom - coord.clientY) / SCROLL_RANGE);

                    const dy = (MIN_SPEED_DY + scale * (MAX_SPEED_DY - MIN_SPEED_DY)) * (dt / 1000);
                    this.frameScroller.parentElement.scrollTop = Math.min(maxScroll, this.frameScroller.parentElement.scrollTop + dy);
                    this.updateDragDrop(coord, offsetY);
                });
            }
        }

        if (!this.state.isMovingFrame) {
            this.setState({
                isMovingFrame: true,
                dropPreviewIndex: this.props.currentFrame,
            });
        }
        else if (this.refs["floating-frame"]) {
            const floating = this.refs["floating-frame"] as HTMLDivElement;
            floating.style.top = scrollY + "px";

            if (this.state.dropPreviewIndex !== index) {
                this.setState({ dropPreviewIndex: index });
            }
        }
    }
}

function mapStateToProps({ store: { present }, editor }: ImageEditorStore, ownProps: any) {
    let state = present as AnimationState;
    if (!state) return {};
    return {
        frames: state.frames,
        currentFrame: state.currentFrame,
        colors: state.colors,
        interval: state.interval,
        previewAnimating: editor.previewAnimating
    };
}

const mapDispatchToProps = {
    dispatchDuplicateFrame,
    dispatchDeleteFrame,
    dispatchChangeCurrentFrame,
    dispatchNewFrame,
    dispatchMoveFrame
};


export const Timeline = connect(mapStateToProps, mapDispatchToProps)(TimelineImpl);

