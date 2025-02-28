import css from "./styling/DraggableColorPicker.module.scss";
import Draggable from "react-draggable";
import { SketchPicker } from "react-color";
import { classList } from "react-common/components/util";
import { Button } from "react-common/components/controls/Button";
import React from "react";

export interface DraggableColorPickerProps {
    color: string;
    onChange: (color: string) => void;
    onClose: () => void;
    className?: string;
    initialPosition?: { x: number; y: number };
}
export const DraggableColorPicker = (props: DraggableColorPickerProps) => {
    return (
        <Draggable handle={`.${css["drag-handle"]}`} defaultPosition={props.initialPosition}>
            <div className={classList(props.className, css["draggable-color-picker"])}>
                <div className={css["control-bar"]}>
                    <i className={classList("fas fa-grip-horizontal", css["drag-handle"])} />
                    <Button onClick={props.onClose} title={"Close picker"} leftIcon="fas fa-times" />
                </div>
                <SketchPicker
                    color={props.color}
                    onChange={e => props.onChange(e.hex)}
                    disableAlpha={false} // TODO thsparks - alpha not working
                    styles={{
                        default: {
                            picker: {
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
