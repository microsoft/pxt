import * as React from 'react';
import * as data from './data';
import * as Snippet from './snippetBuilder';

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

        return { x: Math.round(x / 2) - 4, y: Math.round(y / 2) - 4 };
    }

    onMouseMove(e: React.MouseEvent<HTMLDivElement>) {
        if (e.nativeEvent.offsetX && e.nativeEvent.offsetY) {
            this.setPosition(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
        }
    }

    setDot(e: React.MouseEvent<HTMLDivElement>) {
        const { input, onChange } = this.props;
        const { x, y } = this.state;

        this.setState({
            dotVisible: true,
            finalX: x,
            finalY: y,
        }, () => {
            if (!Snippet.isSnippetInputAnswerSingular(input)) {
                const { x, y } = this.getPosition();
                onChange(input.answerTokens[0])(x.toString());
                onChange(input.answerTokens[1])(y.toString());
            }
        });
    }

    public renderCore() {
        const { x, y, dotVisible, finalX, finalY } = this.state;

        return (
            <div
                ref={'positionPickerContainer'}
                className='position-picker container'
                onMouseMove={this.onMouseMove}
                onClick={this.setDot}
            >
                <div className='position-picker cross-x' />
                <div className='position-picker cross-y' />
                {dotVisible && <div className='position-picker dot' style={{ top: `${finalY}px`, left: `${finalX}px` }} />}
                <div className='position-picker label'>x={Math.round(y / 2)}, y={Math.round(x / 2)}</div>
            </div>
        )
    }
}