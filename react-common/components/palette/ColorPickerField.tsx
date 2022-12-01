import * as React from "react";
import { Button } from "../controls/Button";
import { Input } from "../controls/Input";


export interface ColorPickerFieldProps {
    index: number;
    color: string;
    onColorChanged: (color: string) => void;
    onMoveColor: (up: boolean) => void;
    disabled?: boolean;
}

const colorNames = [
    lf("Transparency"),
    lf("White"),
    lf("Red"),
    lf("Pink"),
    lf("Orange"),
    lf("Yellow"),
    lf("Teal"),
    lf("Green"),
    lf("Blue"),
    lf("Cyan"),
    lf("Purple"),
    lf("Light Purple"),
    lf("Dark Purple"),
    lf("Tan"),
    lf("Brown"),
    lf("Black"),
]


export const ColorPickerField = (props: ColorPickerFieldProps) => {
    const { index, color, onColorChanged, onMoveColor, disabled } = props;

    const [currentColor, setCurrentColor] = React.useState<string | undefined>(undefined);

    const onBlur = () => {
        if (currentColor) onColorChanged(currentColor);
        setCurrentColor(undefined);
    }

    const onColorPickerChanged = (e: React.ChangeEvent<HTMLInputElement>) => {
        setCurrentColor(e.target.value);
    }

    const onTextInputChanged = (newValue: string) => {
        if (/#[0-9a-fA-F]{6}/.test(newValue)) {
            onColorChanged(newValue);
        }
    }

    return <div className="common-color-picker-field">
        <div className="common-color-index">
            {index} ({colorNames[index]})
        </div>
        <div className="common-color-inputs">
            <input type="color" value={currentColor || color} onBlur={onBlur} onChange={onColorPickerChanged} disabled={disabled}  />
            <Input initialValue={currentColor || color} onChange={onTextInputChanged} disabled={disabled} />
        </div>
        <Button className="circle-button" title={lf("Move color up")} leftIcon="fas fa-arrow-up" onClick={() => onMoveColor(true)} disabled={disabled} />
        <Button className="circle-button" title={lf("Move color down")} leftIcon="fas fa-arrow-down" onClick={() => onMoveColor(false)} disabled={disabled} />
    </div>
}