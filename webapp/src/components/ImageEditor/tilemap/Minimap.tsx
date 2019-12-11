import * as React from 'react';
import { connect } from 'react-redux';
import { ImageEditorStore, TilemapState, TileCategory } from '../store/imageReducer';

export interface MinimapProps {
    colors: string[];
    tileset: pxt.sprite.TileSet;
    tilemap: pxt.sprite.ImageState;
}

const SCALE = pxt.BrowserUtils.isEdge() ? 25 : 1;

class MinimapImpl extends React.Component<MinimapProps, {}> {
    protected tileColors: string[] = [];
    protected canvas: HTMLCanvasElement;

    componentDidMount() {
        this.canvas = this.refs["minimap-canvas"] as HTMLCanvasElement;
        this.redrawCanvas();
    }

    componentDidUpdate() {
        this.redrawCanvas();
    }

    render() {
        return <div className="minimap-outer">
            <canvas ref="minimap-canvas" className="paint-surface" />
        </div>
    }

    redrawCanvas() {
        const { tilemap } = this.props;
        let { bitmap, floating, layerOffsetX, layerOffsetY } = tilemap;

        const context = this.canvas.getContext("2d");
        const image = pxt.sprite.Tilemap.fromData(bitmap);
        const floatingImage = floating && floating.bitmap ? pxt.sprite.Tilemap.fromData(floating.bitmap) : null;

        this.canvas.width = image.width * SCALE;
        this.canvas.height = image.height * SCALE;
        this.tileColors = [];

        for (let x = 0; x < image.width; x++) {
            for (let y = 0; y < image.height; y++) {
                const float = floatingImage ? floatingImage.get(x - layerOffsetX, y - layerOffsetY) : null;
                const index = image.get(x, y);
                if (float) {
                    context.fillStyle = this.getColor(float);
                    context.fillRect(x * SCALE, y * SCALE, SCALE, SCALE);
                } else if (index) {
                    context.fillStyle = this.getColor(index);
                    context.fillRect(x * SCALE, y * SCALE, SCALE, SCALE);
                }
                else {
                    context.clearRect(x * SCALE, y * SCALE, SCALE, SCALE);
                }
            }
        }
    }

    protected getColor(index: number) {
        if (!this.tileColors[index]) {
            const { tileset, colors } = this.props;

            if (index >= tileset.tiles.length) {
                return "#ffffff";
            }
            const bitmap = pxt.sprite.Bitmap.fromData(tileset.tiles[index].data);
            this.tileColors[index] = pxt.sprite.computeAverageColor(bitmap, colors);
        }

        return this.tileColors[index];
    }
}


function mapStateToProps({ store: { present }, editor }: ImageEditorStore, ownProps: any) {
    let state = (present as TilemapState);
    if (!state) return {};
    return {
        tilemap: state.tilemap,
        tileset: state.tileset,
        colors: state.colors
    };
}

const mapDispatchToProps = {

};


export const Minimap = connect(mapStateToProps, mapDispatchToProps)(MinimapImpl);