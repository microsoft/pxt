import * as React from "react";

interface AssetPreviewProps {
    asset: pxt.Asset;
}

export const AssetPreview = (props: AssetPreviewProps) => {
    const { asset } = props;
    const title = asset.meta.displayName || (asset.meta.temporaryInfo ? lf("Temporary Asset") : asset.id);

    return (
        <div className="asset-editor-preview" title={title}>
            { asset.type === pxt.AssetType.Json ?
                <JsonAssetPreview {...props} /> :
                <AssetImagePreview {...props} />
            }
        </div>
    )
}

const AssetImagePreview = (props: AssetPreviewProps) => {
    const { asset } = props;

    const ref = React.useRef<HTMLImageElement>(null);
    const isAnimation = asset.type === pxt.AssetType.Animation && asset.framePreviewURIs?.length > 1;

    React.useEffect(() => {
        if (!isAnimation || !ref.current) return undefined;
        let intervalRef: number | undefined;
        let currentFrame = 0;

        const mouseEnter = () => {
            intervalRef = setInterval(() => {
                if (ref.current) {
                    ref.current.src = asset.framePreviewURIs[currentFrame];
                }
                currentFrame = (currentFrame + 1) % asset.framePreviewURIs.length;
            }, Math.max(asset.interval, 100));
        }

        const mouseLeave = () => {
            clearInterval(intervalRef);
        }

        ref.current.addEventListener("mouseenter", mouseEnter);
        ref.current.addEventListener("mouseleave", mouseLeave);

        return () => {
            if (intervalRef) {
                clearInterval(intervalRef);
            }
            ref.current?.removeEventListener("mouseenter", mouseEnter);
            ref.current?.removeEventListener("mouseleave", mouseLeave);
        }
    }, [asset, isAnimation])

    return (
        <img
            src={asset.previewURI}
            alt={lf("A preview of your asset (eg image, tile, animation)")}
            ref={ref}
            // @ts-ignore
            loading="lazy" />
    )
}

const JsonAssetPreview = (props: AssetPreviewProps) => {
    const { asset } = props;

    const name = asset.meta.displayName || lf("Untitled");

    return (
        <div className="json-asset-preview">
            <div>
                {name}
            </div>
        </div>
    )
}