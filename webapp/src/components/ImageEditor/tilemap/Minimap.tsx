import * as React from 'react';
import { LIGHT_MODE_TRANSPARENT } from '../ImageEditor';
import { ImageEditorContext, TilemapState } from '../state';

export interface MinimapProps {
    lightMode: boolean;
}

const SCALE = pxt.BrowserUtils.isEdge() ? 25 : 1;

export const Minimap = (props: MinimapProps) => {
    const { state } = React.useContext(ImageEditorContext);
    const canvasRef = React.useRef<HTMLCanvasElement>();

    const { lightMode } = props;
    const { colors, tilemap, tileset } = (state.store.present as TilemapState);

    React.useEffect(() => {
        let { bitmap, floating, layerOffsetX, layerOffsetY } = tilemap;

        const context = canvasRef.current.getContext("2d");
        const image = pxt.sprite.Tilemap.fromData(bitmap);
        const floatingImage = floating && floating.bitmap ? pxt.sprite.Tilemap.fromData(floating.bitmap) : null;

        canvasRef.current.width = image.width * SCALE;
        canvasRef.current.height = image.height * SCALE;
        const tileColors: string[] = [];

        const getColor = (index: number) => {
            if (!tileColors[index]) {
                if (index >= tileset.tiles.length) {
                    return "#ffffff";
                }
                const bitmap = pxt.sprite.Bitmap.fromData(tileset.tiles[index].bitmap);
                tileColors[index] = pxt.sprite.computeAverageColor(bitmap, colors);
            }

            return tileColors[index];
        }

        for (let x = 0; x < image.width; x++) {
            for (let y = 0; y < image.height; y++) {
                const float = floatingImage ? floatingImage.get(x - layerOffsetX, y - layerOffsetY) : null;
                const index = image.get(x, y);
                if (float) {
                    context.fillStyle = getColor(float);
                    context.fillRect(x * SCALE, y * SCALE, SCALE, SCALE);
                } else if (index) {
                    context.fillStyle = getColor(index);
                    context.fillRect(x * SCALE, y * SCALE, SCALE, SCALE);
                }
                else if (lightMode) {
                    context.fillStyle = LIGHT_MODE_TRANSPARENT;
                    context.fillRect(x * SCALE, y * SCALE, SCALE, SCALE);
                } else {
                    context.clearRect(x * SCALE, y * SCALE, SCALE, SCALE);
                }
            }
        }
    }, [lightMode, colors, tilemap, tileset]);

    return (
        <div className="minimap-outer">
            <canvas ref={canvasRef} className="paint-surface" />
        </div>
    );
}
