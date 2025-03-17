import { ThemePreview } from "./ThemePreview";
import { Card } from "../controls/Card";

interface ThemeCardProps {
    theme: pxt.ColorThemeInfo;
    onClick?: (theme: pxt.ColorThemeInfo) => void;
}

export const ThemeCard = (props: ThemeCardProps) => {
    const { onClick, theme } = props;

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
                <div className="theme-picker-item-name">{theme.name}</div>
            </div>
        </Card>
    );
};
