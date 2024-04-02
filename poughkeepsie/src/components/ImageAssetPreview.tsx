import css from "./styling/ImageAssetPreview.module.scss";

import { useCallback, useContext, useEffect, useRef } from "react";
import { AppStateContext } from "../state/appStateContext";
import { getAsset } from "../utils/project";
import { ImageAsset } from "../types/project";
import { setActiveImage } from "../transforms/setActiveImage";
import { renderBitmap } from "../utils/icons";


interface IProps {
    assetId: number;
}

export const ImageAssetPreview: React.FC<IProps> = ({ assetId }) => {
    const { state } = useContext(AppStateContext);
    const ref = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const asset = getAsset(state.project, assetId) as ImageAsset;
        const canvas = ref.current!;

        canvas.width = asset.frames[0].width;
        canvas.height = asset.frames[0].height;
        let frameIndex = 0;

        let interval = setInterval(() => {
            const frame = pxt.sprite.Bitmap.fromData(asset.frames[frameIndex]);
            renderBitmap(canvas, frame, state.project.palette);

            frameIndex = (frameIndex + 1) % asset.frames.length;
        }, Math.max(asset.interval, 10));

        renderBitmap(canvas, pxt.sprite.Bitmap.fromData(asset.frames[0]), state.project.palette);

        return () => {
            clearInterval(interval);
        }
    }, [assetId, state.project.revision]);

    const onClick = useCallback(() => {
        setActiveImage(assetId);
    }, [assetId])

    return (
        <div className={css["image-asset-preview"]} onClick={onClick}>
            <canvas ref={ref} />
        </div>
    )
};

