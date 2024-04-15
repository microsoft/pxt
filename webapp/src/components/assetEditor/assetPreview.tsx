import * as React from "react";

interface AssetPreviewProps {
    asset: pxt.Asset;
}

export class AssetPreview extends React.Component<AssetPreviewProps> {
    protected ref: HTMLImageElement;
    protected animationIntervalRef: ReturnType<typeof setInterval>;
    protected currentFrame: number;

    render() {
        const { asset } = this.props;

        const isAnimation = asset.type === pxt.AssetType.Animation && asset.framePreviewURIs?.length > 1;

        const title = asset.meta.displayName || (asset.meta.temporaryInfo ? lf("Temporary Asset") : asset.id);

        return <div className="asset-editor-preview" title={title}>
            <img
                src={asset.previewURI}
                alt={lf("A preview of your asset (eg image, tile, animation)")}
                onMouseEnter={isAnimation ? this.onMouseEnter : undefined}
                onMouseLeave={isAnimation ? this.onMouseLeave : undefined}
                ref={isAnimation ? this.handleRef : undefined}
                // @ts-ignore
                loading="lazy" />
        </div>
    }

    componentDidUpdate() {
        if (this.animationIntervalRef) {
            this.restartAnimation();
        }
    }

    componentWillUnmount() {
        this.endAnimation();
    }

    protected onMouseEnter = () => {
        this.restartAnimation();
    }

    protected onMouseLeave = () => {
        this.endAnimation();
    }

    protected endAnimation() {
        if (this.animationIntervalRef) {
            clearInterval(this.animationIntervalRef);
            this.animationIntervalRef = undefined;
            this.ref.src = this.props.asset.previewURI;
        }
    }

    protected restartAnimation = () => {
        this.endAnimation();
        const animation = this.props.asset as pxt.Animation;

        if (animation.type === pxt.AssetType.Animation && animation.framePreviewURIs?.length > 1) {
            this.currentFrame = 0;

            this.animationIntervalRef = setInterval(() => {
                if (this.ref) {
                    this.ref.src = animation.framePreviewURIs[this.currentFrame];
                }
                this.currentFrame = (this.currentFrame + 1) % animation.framePreviewURIs.length;
            }, Math.max(animation.interval, 100));
        }
    }

    protected handleRef = (ref: HTMLImageElement) => {
        if (ref) {
            this.ref = ref;
        }
    }
}