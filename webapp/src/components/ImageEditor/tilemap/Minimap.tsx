import * as React from 'react';
import { connect } from 'react-redux';
import { ImageEditorStore, TilemapState, TileCategory } from '../store/imageReducer';

export interface MinimapProps {
    colors: string[];
    tileset: pxt.sprite.TileSet;
    tilemap: pxt.sprite.ImageState;
}


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

        const context = this.canvas.getContext("2d");
        const bitmap = pxt.sprite.Tilemap.fromData(tilemap.bitmap);

        this.canvas.width = bitmap.width;
        this.canvas.height = bitmap.height;

        for (let x = 0; x < bitmap.width; x++) {
            for (let y = 0; y < bitmap.height; y++) {
                const index = bitmap.get(x, y);
                if (index) {
                    context.fillStyle = this.getColor(index);
                    context.fillRect(x, y, 1, 1);
                }
                else {
                    context.clearRect(x, y, 1, 1);
                }
            }
        }
    }

    protected getColor(index: number) {
        if (!this.tileColors[index]) {
            const { tileset, colors } = this.props;

            const averageColor = [0, 0, 0];

            const bitmap = pxt.sprite.Bitmap.fromData(tileset.tiles[index].data);
            const parsedColors = colors.map(colorStringToRGB);
            let color: number[];

            for (let x = 0; x < bitmap.width; x++) {
                for (let y = 0; y < bitmap.height; y++) {
                    color = parsedColors[bitmap.get(x, y)];
                    averageColor[0] += color[0];
                    averageColor[1] += color[1];
                    averageColor[2] += color[2];
                }
            }

            const numPixels = bitmap.width * bitmap.height;
            this.tileColors[index] = "#" + toHex(averageColor.map(c => Math.floor(c / numPixels)));
            
        }

        return this.tileColors[index];
    }
}

function colorStringToRGB(color: string) {
    const parsed = parseColorString(color);
    return [_r(parsed), _g(parsed), _b(parsed)]
}

function parseColorString(color: string) {
    if (color) {
        if (color.length === 6) {
            return parseInt("0x" + color);
        }
        else if (color.length === 7) {
            return parseInt("0x" + color.substr(1));
        }
    }
    return 0;
}

function _r(color: number) { return (color >> 16) & 0xff }
function _g(color: number) { return (color >> 8) & 0xff }
function _b(color: number) { return color & 0xff }

function toHex(bytes: ArrayLike<number>) {
    let r = ""
    for (let i = 0; i < bytes.length; ++i)
        r += ("0" + bytes[i].toString(16)).slice(-2)
    return r
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