import { ThemePreview } from "./ThemePreview";
import { Card } from "../controls/Card";
import { Button } from "../controls/Button";
import { classList } from "../util";

interface ThemeCardProps {
    theme: pxt.ColorThemeInfo;
    onClick?: (theme: pxt.ColorThemeInfo) => void;
    onRemoveClicked?: (theme: pxt.ColorThemeInfo) => void;
}

export const ThemeCard = (props: ThemeCardProps) => {
    const { onClick, onRemoveClicked, theme } = props;

    const themeName = pxt.Util.rlf(`{id:color-theme-name}${theme.name}`);

    return (
        <Card
            className="theme-card"
            role="listitem"
            aria-label={theme.name}
            key={theme.id}
            onClick={() => onClick(theme)}
            tabIndex={onClick && 0}
        >
            <div className="theme-info-box">
                <ThemePreview theme={theme} />
                <div className="theme-footer">
                    <div className="theme-picker-item-name">{themeName}</div>
                    {theme.isCustom && <Button className={classList("red", "remove-theme-button")} onClick={() => onRemoveClicked(theme)} title={lf("Remove")} leftIcon="fas fa-times" />}
                </div>
            </div>
        </Card>
    );
};
