import css from "./styling/DraggableColorPicker.module.scss";
import Draggable from "react-draggable";
import { SketchPicker, ColorResult } from "react-color";
import { classList } from "react-common/components/util";
import { Button } from "react-common/components/controls/Button";
import { Color, RgbaColor } from "../types/color";
import React from "react";

export interface DraggableColorPickerProps {
    color: string;
    onChange: (color: string) => void;
    onClose: () => void;
    className?: string;
    initialPosition?: { x: number; y: number };
}
export const DraggableColorPicker = (props: DraggableColorPickerProps) => {
    const [parsedColor, setParsedColor] = React.useState<RgbaColor>({r: 0, g: 0, b: 0, a: 1});

    function handleColorChange(c: ColorResult) {
        const colorString = `rgba(${c.rgb.r}, ${c.rgb.g}, ${c.rgb.b}${c.rgb.a ? `, ${c.rgb.a}` : ""})`;
        props.onChange(colorString);
    }

    React.useEffect(() => {
        const c = new Color(props.color);
        const p = c.getParsedColor();
        setParsedColor(p);
    }, [props.color])

    return (
        <Draggable handle={`.${css["drag-handle"]}`} defaultPosition={props.initialPosition}>
            <div className={classList(props.className, css["draggable-color-picker"])}>
                <div className={css["control-bar"]}>
                    <i className={classList("fas fa-grip-horizontal", css["drag-handle"])} />
                    <Button onClick={props.onClose} title={"Close picker"} leftIcon="fas fa-times" />
                </div>
                <SketchPicker
                    color={parsedColor}
                    onChange={(c, e) => handleColorChange(c)}
                    disableAlpha={false} // TODO thsparks - alpha not working
                    styles={{
                        default: {
                            picker: {
                                // We create our own shadow on parent container w/ control bar, so hide the default one
                                boxShadow: "none",
                                padding: "0 0.5rem",
                            },
                        },
                    }}
                />
            </div>
        </Draggable>
    );
};
