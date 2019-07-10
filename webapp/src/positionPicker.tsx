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
}

export class PositionPicker extends data.Component <PositionPickerProps, PositionPickerState> {
    constructor(props: PositionPickerProps) {
        super(props);
        this.state = {
            x: this.props.defaultX || 80,
            y: this.props.defaultY || 120,
        };

        this.onMouseMove = this.onMouseMove.bind(this);
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

        return { x: Math.round(x / 2), y: Math.round(y / 2) };
    }

    onMouseMove(e: React.MouseEvent<any>) {
        const { input, onChange } = this.props;

        if (e.nativeEvent.offsetX && e.nativeEvent.offsetY) {
            this.setPosition(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
        }
        if (!Snippet.isSnippetInputAnswerSingular(input)) {
            const { x, y } = this.getPosition();
            onChange(input.answerTokens[0])(x.toString());
            onChange(input.answerTokens[1])(y.toString());
        }
    }

    public renderCore() {
        const { x, y } = this.state;

        return (
            <div ref={'positionPickerContainer'} className='position-picker container' onMouseMove={this.onMouseMove}>
                <div className='position-picker cross-x' style={{ top: y }} />
                <div className='position-picker cross-y' style={{ left: x }} />
                <div className='position-picker label' style={{ top: y + 4, left: x + 4 }}>x={Math.round(y / 2)}, y={Math.round(x / 2)}</div>
            </div>
        )
    }
}