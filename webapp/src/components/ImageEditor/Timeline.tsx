import * as React from "react";
import { connect } from "react-redux";

import { ImageEditorStore } from "./store/imageReducer";
import { dispatchChangeCurrentFrame, dispatchNewFrame, dispatchDuplicateFrame, dispatchDeleteFrame, dispatchMoveFrame } from "./actions/dispatch";

import { TimelineFrame } from "./TimelineFrame";
import { bindGestureEvents, ClientCoordinates } from "./util";

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
    protected canvas: HTMLCanvasElement;
    protected frameScroller: HTMLDivElement;
    protected scrollOffset = 0;
    protected dragEnd = false;

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
            <div className="image-editor-timeline">
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
                        <div className="image-editor-timeline-frame collapsed" role="button" onClick={this.newFrame}>
                            <span className="ms-Icon ms-Icon--Add" />
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    componentDidMount() {
        this.canvas = this.refs["preview-canvas"] as HTMLCanvasElement;
        this.frameScroller = this.refs["frame-scroller-ref"] as HTMLDivElement;
        this.redraw();

        let last: number;
        let isScroll = false;
        bindGestureEvents(this.frameScroller, {
            onClick: coord => {
                this.dragEnd = false;
            },
            onDragStart: coord => {
                last = coord.clientY;
                pxt.BrowserUtils.addClass(this.frameScroller, "scrolling");

                const parent = this.frameScroller.getBoundingClientRect();
                const scrollY = coord.clientY - parent.top;

                const unit = this.frameScroller.firstElementChild.getBoundingClientRect().height;
                const index = Math.floor(scrollY / unit);

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
                    this.updateDragDrop(coord);
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

    componentDidUpdate() {
        this.redraw();
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

    protected redraw() {
        if (!this.canvas) return;

        const { frames, currentFrame } = this.props;

        const imageState = frames[currentFrame];

        this.canvas.height = imageState.bitmap.height;
        this.canvas.width = imageState.bitmap.width;

        const bitmap = pxt.sprite.Bitmap.fromData(imageState.bitmap);
        this.drawBitmap(bitmap);

        if (imageState.floatingLayer) {
            const floating = pxt.sprite.Bitmap.fromData(imageState.floatingLayer);
            this.drawBitmap(floating, imageState.layerOffsetX, imageState.layerOffsetY, true);
        }
    }

    protected drawBitmap(bitmap: pxt.sprite.Bitmap, x0 = 0, y0 = 0, transparent = false) {
        const { colors } = this.props;

        const context = this.canvas.getContext("2d");
        context.imageSmoothingEnabled = false;
        for (let x = 0; x < bitmap.width; x++) {
            for (let y = 0; y < bitmap.height; y++) {
                const index = bitmap.get(x, y);

                if (index) {
                    context.fillStyle = colors[index];
                    context.fillRect(x + x0, y + y0, 1, 1);
                }
                else {
                    if (!transparent) context.clearRect(x + x0, y + y0, 1, 1);
                }
            }
        }
    }

    protected updateDragDrop(coord: ClientCoordinates) {
        const parent = this.frameScroller.getBoundingClientRect();
        const scrollY = coord.clientY - parent.top;

        const unit = this.frameScroller.firstElementChild.getBoundingClientRect().height;
        const index = Math.floor(scrollY / unit);

        if (!this.state.isMovingFrame) {
            this.setState({
                isMovingFrame: true,
                dropPreviewIndex: this.props.currentFrame,
            });
        }
        else if (this.refs["floating-frame"]) {
            const floating = this.refs["floating-frame"] as HTMLDivElement;
            floating.style.top = scrollY + "px";

            this.setState({ dropPreviewIndex: index });
        }
    }
}

function mapStateToProps({ present: state, editor }: ImageEditorStore, ownProps: any) {
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

