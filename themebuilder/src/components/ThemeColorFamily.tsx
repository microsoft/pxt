import * as React from "react";
import css from "./styling/ThemeEditor.module.scss";
import { ThemeColorSetter } from "./ThemeColorSetter";
import { Button } from "react-common/components/controls/Button";
import { classList } from "react-common/components/util";

export interface ThemeColorFamilyProps {
    key: string;
    baseColorId: string;
    derivedColorIds: string[];
}
export const ThemeColorFamily = (props: ThemeColorFamilyProps) => {
    const { key, baseColorId, derivedColorIds } = props;
    const [expanded, setExpanded] = React.useState<boolean>(false);

    function toggleExpanded() {
        setExpanded(!expanded);
    }

    // Structure here is somewhat counter intuitive, but done so the header row aligns with derived rows
    // when expanded. Basically expand button is on the left, then the full row list is to the right but
    // only has one row when collapsed (the base row) and has multiple rows when expanded.
    return (
        <div className={css["theme-color-family-root"]} key={key}>
            <Button
                onClick={toggleExpanded}
                className={css["expand-collapse-button"]}
                title={expanded ? lf("Collapse Derived Colors") : lf("Expand Derived Colors")}
                leftIcon={expanded ? "fas fa-caret-down" : "fas fa-caret-right"}
            />
            <div className={css["color-setters"]}>
                <ThemeColorSetter colorId={baseColorId} className={classList(css["theme-color-setter"], css["base-color-setter"])}/>
                {expanded && derivedColorIds.map(colorId => (
                    <ThemeColorSetter key={`derived-color-setter-${colorId}`} colorId={colorId} className={classList(css["theme-color-setter"], css["derived-color-setter"])}/>
                ))}
            </div>
        </div>
    );
};
