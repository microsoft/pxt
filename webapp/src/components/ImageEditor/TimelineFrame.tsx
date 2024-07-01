import * as React from "react";
import { IconButton } from "./Button";

interface TimelineFrameProps {
    frames: pxt.sprite.ImageState[];
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

/**
 * This is a scaling factor for all of the pixels in the canvas. Scaling is not needed for browsers
 * that support "image-rendering: pixelated," so only scale for Microsoft Edge and Chrome on MacOS.
 *
 * Chrome on MacOS should be fixed in the next release: https://bugs.chromium.org/p/chromium/issues/detail?id=134040
 */
const SCALE = pxt.BrowserUtils.isEdge() ? 25 : 1;

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

        this.canvas.height = imageState.bitmap.height * SCALE;
        this.canvas.width = imageState.bitmap.width * SCALE;

        const bitmap = pxt.sprite.Bitmap.fromData(imageState.bitmap);
        this.drawBitmap(bitmap);

        if (imageState.floating && imageState.floating.bitmap) {
            const floating = pxt.sprite.Bitmap.fromData(imageState.floating.bitmap);
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

    protected drawBitmap(bitmap: pxt.sprite.Bitmap, x0 = 0, y0 = 0, transparent = false) {
        const { colors } = this.props;

        const context = this.canvas.getContext("2d");
        for (let x = 0; x < bitmap.width; x++) {
            for (let y = 0; y < bitmap.height; y++) {
                const index = bitmap.get(x, y);

                if (index) {
                    context.fillStyle = colors[index];
                    context.fillRect((x + x0) * SCALE, (y + y0) * SCALE, SCALE, SCALE);
                }
                else {
                    if (!transparent) context.clearRect((x + x0) * SCALE, (y + y0) * SCALE, SCALE, SCALE);
                }
            }
        }
    }
}