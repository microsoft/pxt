import * as React from "react";
import css from "./styling/ThemeEditor.module.scss";
import { Input } from "react-common/components/controls/Input";
import { AppStateContext } from "../state/appStateContext";
import { Button } from "react-common/components/controls/Button";
import { toggleColorHighlight } from "../transforms/toggleColorHighlight";
import { classList } from "react-common/components/util";
import { setColorValue } from "../transforms/setColorValue";

export interface ThemeColorSetterProps {
    key?: string;
    colorId: string;
    className?: string;
}
export const ThemeColorSetter = (props: ThemeColorSetterProps) => {
    const { state } = React.useContext(AppStateContext);
    const { editingTheme } = state;
    const { key, colorId, className } = props;
    const [isHighlighted, setIsHighlighted] = React.useState<boolean>(false);

    React.useEffect(() => {
        setIsHighlighted(!!state.colorsToHighlight?.includes(colorId));
    }, [state.colorsToHighlight]);

    const color = editingTheme?.colors[colorId];
    if (!color) return null;
    return (
        <div key={key} className={className}>
            <Button
                className={classList(css["highlight-color-button"], isHighlighted ? css["highlighted"] : undefined)}
                style={isHighlighted ? { borderColor: state.highlightColor, color: state.highlightColor } : undefined}
                leftIcon="fas fa-search"
                title={lf("Highlight color")}
                onClick={() => toggleColorHighlight(colorId)}
            />
            <Input
                className={css["theme-color-input"]}
                label={colorId}
                initialValue={color}
                onBlur={value => setColorValue(colorId, value)}
                onEnterKey={value => setColorValue(colorId, value)}
            />
            <input
                type="color"
                className={css["theme-color-button"]}
                value={color}
                onChange={e => setColorValue(colorId, e.target.value)}
            />
        </div>
    );
};
