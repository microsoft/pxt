import css from "./styling/DraggableColorPicker.module.scss";
import { SketchPicker } from "react-color";
import { classList } from "react-common/components/util";
import { Button } from "react-common/components/controls/Button";

export interface DraggableColorPickerProps {
    color: string;
    onChange: (color: string) => void;
    onClose: () => void;
    className?: string;
}
export const DraggableColorPicker = (props: DraggableColorPickerProps) => {
    // TODO - make this draggable
    return (
        <div className={classList(props.className, css["draggable-color-picker"])}>
            <div className={css["control-bar"]}>
                <i className="fas fa-grip-horizontal" />
                <Button onClick={props.onClose} title={"Close picker"} leftIcon="fas fa-times"/>
            </div>
            <SketchPicker
                color={props.color}
                onChange={e => props.onChange(e.hex)}
                styles={
                    {
                        default: {
                            picker: {
                                boxShadow: "none",
                                padding: "0 0.5rem"
                            },
                        },
                    }
                }
            />
        </div>
    );
};
