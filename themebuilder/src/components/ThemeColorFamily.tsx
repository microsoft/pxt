import * as React from "react";
import css from "./styling/ThemeEditor.module.scss";
import { ThemeColorSetter } from "./ThemeColorSetter";
import { Button } from "react-common/components/controls/Button";

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

    return (
        <div className={css["theme-color-family-root"]} key={key}>
            <div className={css["theme-color-family-base-row"]}>
                <Button
                    onClick={toggleExpanded}
                    className={css["expand-collapse-button"]}
                    title={expanded ? lf("Collapse Derived Colors") : lf("Expand Derived Colors")}
                    leftIcon={expanded ? "fas fa-caret-down" : "fas fa-caret-right"}
                />
                <ThemeColorSetter colorId={baseColorId} />
            </div>
            {expanded && (
                <div className={css["derived-color-set"]}>
                    {derivedColorIds.map(colorId => (
                        <ThemeColorSetter key={`derived-color-setter-${colorId}`} colorId={colorId} />
                    ))}
                </div>
            )}
        </div>
    );
};
