import { ThemePreview } from "./ThemePreview";
import { Card } from "../controls/Card";

interface ThemeCardProps {
    theme: pxt.ColorThemeInfo;
    selected: boolean;
    onClick: (theme: pxt.ColorThemeInfo) => void;
}

export const ThemeCard = (props: ThemeCardProps) => {
    const { onClick, selected, theme } = props;

    const themeName = pxt.Util.rlf(`{id:color-theme-name}${theme.name}`);

    return (
        <Card
            className={`theme-card${selected ? " selected" : ""}`}
            role="listitem"
            ariaLabelledBy={theme.id + "-title"}
            ariaPressed={selected}
            key={theme.id}
            onClick={() => onClick(theme)}
            tabIndex={0}
        >
            <div className="theme-info-box">
                <ThemePreview theme={theme} />
                <div id={theme.id + "-title"} className="theme-picker-item-name">{themeName}</div>
            </div>
        </Card>
    );
};
