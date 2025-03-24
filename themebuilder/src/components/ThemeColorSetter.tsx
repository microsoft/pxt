import * as React from "react";
import css from "./styling/ThemeEditor.module.scss";
import { Input } from "react-common/components/controls/Input";
import { AppStateContext } from "../state/appStateContext";
import { Button } from "react-common/components/controls/Button";
import { toggleColorHighlight } from "../transforms/toggleColorHighlight";
import { classList } from "react-common/components/util";
import { setColorValue } from "../transforms/setColorValue";
import { DraggableColorPicker } from "./DraggableColorPicker";
import { Color } from "../types/color";

export interface ThemeColorSetterProps {
    key?: string;
    colorId: string;
    className?: string;
}
export const ThemeColorSetter = (props: ThemeColorSetterProps) => {
    const { state } = React.useContext(AppStateContext);
    const { editingTheme } = state;
    const { key, colorId, className } = props;

    const [color, setColor] = React.useState<Color>(new Color("#000000"));
    const [colorPickerOpen, setColorPickerOpen] = React.useState<boolean>(false);
    const [isHighlighted, setIsHighlighted] = React.useState<boolean>(false);
    const [readableColorName, setReadableColorName] = React.useState<string | undefined>(undefined);

    const openPickerButtonRef = React.useRef<HTMLButtonElement | null>(null);
    const setOpenPickerButtonRef = React.useCallback((el: HTMLButtonElement | null) => {
        openPickerButtonRef.current = el;
    }, []);

    React.useEffect(() => {
        setIsHighlighted(!!state.colorsToHighlight?.includes(colorId));
    }, [state.colorsToHighlight]);

    React.useEffect(() => {
        const parsedColor = new Color(editingTheme?.colors[colorId] || "#000000");
        setColor(parsedColor);
    }, [editingTheme?.colors[colorId], colorId]);

    React.useEffect(() => {
        let readableName = colorId;
        if (readableName.startsWith("pxt-")) {
            readableName = readableName.substring(4); // Remove pxt prefix
        }
        if (readableName.startsWith("colors-")) {
            readableName = readableName.substring(7); // Remove colors prefix
        }
        readableName = readableName.replace(/-/g, " "); // Replace dashes with spaces
        readableName = readableName.replace(/\b\w/g, char => char.toUpperCase()); // Capitalize the first letter of each word
        readableName = readableName.replace(/([A-Za-z])(\d)/g, "$1 $2"); // Add spaces before numbers
        setReadableColorName(readableName);
    }, [props.colorId]);

    function getColorPickerPosition() {
        if (!openPickerButtonRef.current) return { x: 0, y: 0 };

        const rect = openPickerButtonRef.current.getBoundingClientRect();
        return {
             // intentionally moving a tad to the left and up from the button.
            x: rect.left - 5,
            y: rect.top - 5,
        };
    }

    if (!color) return null;
    return (
        <div key={key} className={className}>
            <Button
                className={classList(css["highlight-color-button"], isHighlighted ? css["highlighted"] : undefined)}
                style={isHighlighted ? { borderColor: state.highlightForeground, color: state.highlightForeground, background: state.highlightBackground } : undefined}
                leftIcon="fas fa-search"
                title={lf("Highlight color")}
                onClick={() => toggleColorHighlight(colorId)}
            />
            <Input
                className={css["theme-color-input"]}
                label={readableColorName || colorId}
                initialValue={color.toHex()}
                onBlur={value => setColorValue(colorId, value)}
                onEnterKey={value => setColorValue(colorId, value)}
                preserveValueOnBlur={true}
            />
            <Button
                className={css["theme-color-button"]}
                style={{ backgroundColor: color.toHex() }}
                onClick={() => setColorPickerOpen(!colorPickerOpen)}
                title={lf("Open color picker")}
                buttonRef={setOpenPickerButtonRef}
            />
            {colorPickerOpen && <DraggableColorPicker
                color={color.toHex()}
                className="theme-color-picker"
                onClose={() => setColorPickerOpen(false)}
                onChange={c => setColorValue(colorId, c)}
                initialPosition={getColorPickerPosition()}
            />}
        </div>
    );
};
