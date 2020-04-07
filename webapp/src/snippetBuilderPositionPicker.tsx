import * as React from 'react';
import * as data from './data';
import * as Snippet from './snippetBuilder';
import * as sui from './sui';
import { SimulatorDisplay } from './snippetBuilderSimulatorDisplay';

const PICKER_WIDTH  = 309;
const PICKER_HEIGHT = 227;
const FULLSIZE_BROWSER_WIDTH = 2100;
const FULLSIZE_BROWSER_HEIGHT = 1003;
const SIMULATOR_HEIGHT = 120;
const SIMULATOR_WIDTH = 160;

interface PositionPickerProps {
    valueMap?: pxt.Map<number>;
    defaultX?: number;
    defaultY?: number;
    input: pxt.SnippetQuestionInput;
    onChange: (answerToken: string) => (v: string) => void;
}

interface PositionPickerState {
    x: number;
    y: number;
    dotVisible: boolean;
    scale?: number;
}


/**
 * TODO
 * 1. Slight issues with keeping the value written in the textbox and the one picked with a mouse in sync when switching back and forth
 * 2. Dot slides on resize, recalculate the dots top and left based on new scale
 */
export class PositionPicker extends data.Component <PositionPickerProps, PositionPickerState> {
    constructor(props: PositionPickerProps) {
        super(props);
        this.state = {
            x: this.unScalePointX(this.props.defaultX || 80),
            y: this.unScalePointY(this.props.defaultY || 60),
            dotVisible: false,
        };

        this.setDot = this.setDot.bind(this);
        this.onChange = this.onChange.bind(this);
        this.setScale = this.setScale.bind(this);
    }

    componentWillUnmount() {
        window.removeEventListener('resize', this.setScale);
    }

    componentDidMount() {
        // Run once on component mount
        this.setScale();
        window.addEventListener('resize', this.setScale);
    }

    /**
     * Sets the number to scale the position picker and simulator display
     */
    protected setScale() {
        // scale = 1 height is 1023 - constant (FULLSIZE_BROWSER_HEIGHT)
        const height = window.innerHeight;
        // scale = 1 height is 2100 - constant (FULLSIZE_BROWSER_WIDTH)
        const width = window.innerWidth;

        let scale = height > width ? (width / FULLSIZE_BROWSER_WIDTH) : (height / FULLSIZE_BROWSER_HEIGHT);
        // Minimum resize threshold .71
        if (scale < .71) {
            scale = .71;
        }
        // Maximum resize threshhold
        else if (scale > 1.01) {
            scale = 1.01;
        }

        this.setState({ scale });
    }

    /** Returns proper scale for calculating position */
    protected getScale(scaleDivisor: number, scaleMultiplier: number) {
        const { scale } = this.state;
        const currentWidth = scaleMultiplier * scale;

        return currentWidth / scaleDivisor;
    }

    /** Calls getScale with picker width and simulator width */
    protected getXScale() {
        return this.getScale(SIMULATOR_WIDTH, PICKER_WIDTH);
    }

    /** Calls getScale with picker height and simulator height */
    protected getYScale() {
        return this.getScale(SIMULATOR_HEIGHT, PICKER_HEIGHT);
    }

    protected scalePoint(point: number, scale: number) {

        if (!isNaN(point)) {
            return Math.round(point / scale);
        }

        return 0;
    }

    protected scalePointX(point: number) {
        return this.scalePoint(point, this.getXScale());
    }

    protected scalePointY(point: number) {
        return this.scalePoint(point, this.getYScale())
    }

    protected unScalePoint(point: number, scale: number) {
        if (!isNaN(point)) {

            return Math.round(point * scale);
        }

        return 0;
    }

    protected unScalePointX(point: number) {
        return this.unScalePoint(point, this.getXScale());
    }

    protected unScalePointY(point: number) {
        return this.unScalePoint(point, this.getYScale());
    }

    protected getScaledPoints() {
        const { x, y } = this.state;

        return {
            x: this.scalePointX(x),
            y: this.scalePointY(y),
        };
    }

    protected scalePixel(numberToScale: number) {
        const { scale } = this.state;

        return `${(numberToScale * scale)}px`;
    }

    protected setDot(e: React.MouseEvent<HTMLDivElement>) {
        const { input, onChange } = this.props;
        const mouseX = e.nativeEvent.offsetX;
        const mouseY = e.nativeEvent.offsetY;

        this.setState({
            dotVisible: true,
            x: Math.round(mouseX),
            y: Math.round(mouseY),
        }, () => {
            if (!Snippet.isSnippetInputAnswerSingular(input)) {
                const pos = this.getScaledPoints();

                onChange(input.answerTokens[0])(pos.x.toString());
                onChange(input.answerTokens[1])(pos.y.toString());
            }
        });
    }

    protected onChange = (x: boolean) => (v: string) => {
        const { input, onChange } = this.props;

        if (!Snippet.isSnippetInputAnswerSingular(input)) {
            const pos = this.state;
            let newValue = parseInt(v);
            if (isNaN(newValue) || newValue < 0) {
                // Return if change is not valid
                return;
            }

            this.setState({
                x: x ? this.unScalePointX(newValue) : pos.x,
                y: !x ? this.unScalePointY(newValue) : pos.y,
            }, () => {
                const pos = this.getScaledPoints();
                if (x) onChange(input.answerTokens[0])(pos.x.toString());
                if (!x) onChange(input.answerTokens[1])(pos.y.toString());

                this.setState({
                    dotVisible: true,
                });
            });
        }
    }

    public renderCore() {
        const { dotVisible, x, y, scale } = this.state;
        const pos = this.getScaledPoints();

        return (
            <div>
                <div className='ui grid'>
                    <div className='column'>
                        <sui.Input
                            class={'position-picker preview-input'}
                            value={(pos.x).toString()}
                            onChange={this.onChange(true)}
                        />
                    </div>
                    <div className='column'>
                        <sui.Input
                            class={'position-picker preview-input'}
                            value={(pos.y).toString()}
                            onChange={this.onChange(false)}
                        />
                    </div>
                </div>
                <SimulatorDisplay scale={scale}>
                    <div
                        ref={'positionPickerContainer'}
                        className='position-picker container'
                        onClick={this.setDot}
                        style={{
                            left: this.scalePixel(28),
                            top: this.scalePixel(28),
                            width: this.scalePixel(PICKER_WIDTH),
                            height: this.scalePixel(PICKER_HEIGHT),
                            margin: `8px`,
                            maxWidth: this.scalePixel(PICKER_WIDTH),
                            maxHeight: this.scalePixel(PICKER_HEIGHT),
                        }}
                        role='grid'
                    >
                        {dotVisible && <div className='position-picker dot' style={{ top: `${y}px`, left: `${x}px` }} />}
                    </div>
                </SimulatorDisplay>
            </div>
        )
    }
}