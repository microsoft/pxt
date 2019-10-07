import * as React from "react";
import { ImageState, Bitmap } from "./store/bitmap";
import { IconButton } from "./Button";

interface TimelineFrameProps {
    frames: ImageState[];
    colors: string[];
    animating?: boolean;
    interval?: number;
    showActions?: boolean;
    duplicateFrame?: () => void;
    deleteFrame?: () => void;
}

interface TimelineFrameState {
    index: number;
}

export class TimelineFrame extends React.Component<TimelineFrameProps, TimelineFrameState> {
    protected canvas: HTMLCanvasElement;

    protected intervalId: number;
    protected intervalcurrent: number;

    constructor(props: TimelineFrameProps) {
        super(props);
        this.state = { index: 0 };
    }

    render() {
        const { frames, animating, showActions, duplicateFrame, deleteFrame } = this.props;
        const frameIndex = animating ? Math.min(Math.max(0, this.state.index), frames.length - 1) : 0;
        const imageState = frames[frameIndex];

        const isPortrait = imageState.bitmap.height > imageState.bitmap.width;

        return <div className={`timeline-frame-outer ${isPortrait ? "portrait" : "landscape"}`} >
            <div className="timeline-frame-spacer" />
            <canvas ref="preview-canvas"></canvas>
            <div className="timeline-frame-spacer" />
            {showActions &&
                <div className="timeline-frame-actions">
                    <IconButton
                        iconClass="ms-Icon ms-Icon--Copy"
                        title={lf("Duplicate Current Frame")}
                        onClick={duplicateFrame}
                    />
                    <IconButton
                        iconClass="ms-Icon ms-Icon--Delete"
                        title={lf("Delete Current Frame")}
                        onClick={deleteFrame}
                    />
                </div>
            }
        </div>
    }

    componentDidMount() {
        this.canvas = this.refs["preview-canvas"] as HTMLCanvasElement;
        this.redraw();
        this.updateAnimation();
    }

    componentDidUpdate() {
        this.redraw();
        this.updateAnimation();
    }

    componentWillUnmount() {
        if (this.intervalId) clearInterval(this.intervalId);
        this.intervalId = undefined;
    }

    protected redraw() {
        if (!this.canvas) return;

        const { animating, frames } = this.props;

        const frameIndex = animating ? Math.min(Math.max(0, this.state.index), frames.length - 1) : 0;
        const imageState = frames[frameIndex];

        this.canvas.height = imageState.bitmap.height;
        this.canvas.width = imageState.bitmap.width;

        const bitmap = Bitmap.fromData(imageState.bitmap);
        this.drawBitmap(bitmap);

        if (imageState.floatingLayer) {
            const floating = Bitmap.fromData(imageState.floatingLayer);
            this.drawBitmap(floating, imageState.layerOffsetX, imageState.layerOffsetY, true);
        }
    }

    protected updateAnimation() {
        const { animating, interval, frames } = this.props;

        const shouldAnimate = animating && interval > 5 && frames.length > 1;

        if (shouldAnimate && interval !== this.intervalcurrent) {
            if (this.intervalId) clearInterval(this.intervalId);
            this.intervalId = setInterval(() => this.setState({
                index: (this.state.index + 1) % this.props.frames.length
            }), interval)
            this.intervalcurrent = interval;
        }
        else if (!shouldAnimate && this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = undefined;
            this.intervalcurrent = undefined;
        }
    }

    protected drawBitmap(bitmap: Bitmap, x0 = 0, y0 = 0, transparent = false) {
        const { colors } = this.props;

        const context = this.canvas.getContext("2d");
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
}