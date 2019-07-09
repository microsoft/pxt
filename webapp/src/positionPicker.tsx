import * as React from 'react';
import * as data from './data';

interface PositionPickerProps {
    dragImage?: string;
    valueMap?: pxt.Map<number>;
}

export class PositionPicker extends data.Component <PositionPickerProps, {}> {

    getImageLocationOnDrag() {

        return {
            x: 0,
            y: 0,
        }
    }

    setAnswerMap() {
        const { x, y } = this.getImageLocationOnDrag();

    }

    onDrag(ev: DragEvent) {

        this.setAnswerMap();
    }

    onDrop(ev: DragEvent) {

        this.setAnswerMap();
    }

    public renderCore() {
        const { dragImage, valueMap } = this.props;

        return (
            <div className='position-picker container'>
                {dragImage && <img src={dragImage} alt="drag me" />}
            </div>
        )
    }
}