import * as React from "react";
import { Input } from "react-common/components/controls/Input";
import { setCurrentFrameTheme } from "../transforms/setCurrentFrameTheme";
import css from "./styling/ThemeEditor.module.scss";
import { AppStateContext } from "../state/appStateContext";


export const ThemeEditorPane = () => {
    const { state } = React.useContext(AppStateContext);
    const { theme } = state;

    function setThemeName(name: string) {
        if (theme) {
            const id = name.toLocaleLowerCase().replace(" ", "-").replace(/[^a-z0-9-]/g, "");
            setCurrentFrameTheme ({...theme, id, name});
        }
    }

    function setColorValue(colorId: string, value: string) {
        if (theme) {
            setCurrentFrameTheme({ ...theme, colors: { ...theme.colors, [colorId]: value } });
        }
    }

    return !theme ? null : (
        <div className={css["theme-editor-container"]}>
            <Input className={css["theme-name-input"]} label={lf("Theme Name")} onBlur={setThemeName} onEnterKey={setThemeName} initialValue={theme.name} />
            <div className={css["theme-colors-list"]} >
                {Object.keys(theme.colors).map((colorId) => {
                    const color = theme.colors[colorId];
                    return <div key={`theme-color-wrapper-${colorId}`} className={css["theme-color-wrapper"]}>
                        <Input className={css["theme-color-input"]} label={colorId} initialValue={color} onBlur={value => setColorValue(colorId, value)} onEnterKey={value => setColorValue(colorId, value)} />
                        {/* <Button className={css["color-preview"]} style={{ backgroundColor: color }} onClick={() => {}} title={lf("Choose color: {0}", colorId)} /> */}
                        <input type="color" className={css["theme-color-button"]} value={color} onChange={e => setColorValue(colorId, e.target.value)} />
                    </div>
                })}
            </div>
        </div>
    );
}
