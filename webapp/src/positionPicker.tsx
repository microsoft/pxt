import * as React from 'react';
import * as data from './data';
import * as Snippet from './snippetBuilder';
import * as sui from './sui';
import { SimulatorDisplay } from './simulatorDisplay';

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
    finalX?: number;
    finalY?: number;
    dotVisible: boolean;
}

export class PositionPicker extends data.Component <PositionPickerProps, PositionPickerState> {
    constructor(props: PositionPickerProps) {
        super(props);
        this.state = {
            x: this.props.defaultX || 80,
            y: this.props.defaultY || 120,
            dotVisible: false,
        };

        this.onMouseMove = this.onMouseMove.bind(this);
        this.setDot = this.setDot.bind(this);
        this.onChange = this.onChange.bind(this);
    }

    setPosition(x: number, y: number) {
        const pickerContainer = this.refs['positionPickerContainer'] as HTMLDivElement;
        const width = pickerContainer.clientWidth;
        const height = pickerContainer.clientHeight;

        x = Math.round(Math.max(0, Math.min(width, x + 4)));
        y = Math.round(Math.max(0, Math.min(height, y + 4)));

        this.setState({ x, y });
    }

    getPosition() {
        const { x, y } = this.state;

        return { x: Math.round(x / 2), y: Math.round(y / 2) - 4 };
    }

    onMouseMove(e: React.MouseEvent<HTMLDivElement>) {
        if (e.nativeEvent.offsetX && e.nativeEvent.offsetY) {
            this.setPosition(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
        }
    }

    setDot(e: React.MouseEvent<HTMLDivElement>) {
        const { input } = this.props;
        const { x, y } = this.state;

        this.setState({
            dotVisible: true,
            finalX: x,
            finalY: y,
        }, () => {
            if (!Snippet.isSnippetInputAnswerSingular(input)) {
                const { x, y } = this.getPosition();
                this.onChange(true)(x.toString());
                this.onChange(false)(y.toString());
            }
        });
    }

    onChange = (x: boolean) => (v: string) => {
        const { input, onChange } = this.props;

        if (!Snippet.isSnippetInputAnswerSingular(input)) {
            onChange(input.answerTokens[x ? 0 : 1])(v);
        }
    }

    drawGrid() {
        let gridDivs: JSX.Element[] = [];
        for (let i = 1; i < 11; ++i) {
            gridDivs.push(<div className='position-picker cross-y' style={{ left: `${i * 32}px` }} key={`grid-line-y-${i}`} />)
            gridDivs.push(<div className='position-picker cross-x' style={{ top: `${i * 24}px` }} key={`grid-line-x-${i}`} />);
        }

        return gridDivs;
    }

    public renderCore() {
        const { input } = this.props;
        const { x, y, dotVisible, finalX, finalY } = this.state;

        return (
            <SimulatorDisplay>
                <div
                    ref={'positionPickerContainer'}
                    className='position-picker container'
                    onMouseMove={this.onMouseMove}
                    onClick={this.setDot}
                >
                    {this.drawGrid().map((grid) => grid)}
                    <div className='position-picker cross-x' />
                    <div className='position-picker cross-y' />
                    {dotVisible && <div className='position-picker dot' style={{ top: `${finalY - 5}px`, left: `${finalX - 5}px` }} />}
                    <div className='position-picker label'>x={Math.round(y / 2)}, y={Math.round(x / 2)}</div>
                </div>
            </SimulatorDisplay>
        )
    }
}