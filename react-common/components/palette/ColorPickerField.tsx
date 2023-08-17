import * as React from "react";
import { Button } from "../controls/Button";
import { Input } from "../controls/Input";


export interface ColorPickerFieldProps {
    index: number;
    color: string;
    onColorChanged: (color: string) => void;
    onMoveColor: (up: boolean) => void;
}

export const ColorPickerField = (props: ColorPickerFieldProps) => {
    const { index, color, onColorChanged, onMoveColor } = props;

    const [currentColor, setCurrentColor] = React.useState<string | undefined>(undefined);

    const onBlur = () => {
        if (currentColor) onColorChanged(currentColor);
        setCurrentColor(undefined);
    }

    const onColorPickerChanged = (e: React.ChangeEvent<HTMLInputElement>) => {
        setCurrentColor(e.target.value.toUpperCase());
    }

    const onTextInputChanged = (newValue: string) => {
        newValue = newValue.trim();
        if (newValue?.[0] != '#') {
            newValue = "#" + newValue;
        }
        if (newValue.length > 7) {
            newValue = newValue.substring(0, 7);
        }
        if (/#[0-9a-fA-F]{6}/.test(newValue)) {
            onColorChanged(newValue.toUpperCase());
        }
    }

    return <div className="common-color-picker-field">
        <div className="common-color-index">
            {index}
        </div>
        <div className="common-color-inputs">
            <input className="color-input" type="color" value={currentColor || color} onBlur={onBlur} onChange={onColorPickerChanged} />
            <Input initialValue={currentColor || color.toUpperCase()} onChange={onTextInputChanged} />
        </div>
        <Button className="circle-button" title={lf("Move color up")} leftIcon="fas fa-arrow-up" onClick={() => onMoveColor(true)} disabled={index === 1}/>
        <Button className="circle-button" title={lf("Move color down")} leftIcon="fas fa-arrow-down" onClick={() => onMoveColor(false)} disabled={index === 15}/>
    </div>
}