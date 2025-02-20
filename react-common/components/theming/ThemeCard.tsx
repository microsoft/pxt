import * as React from "react";
import { ThemePreview } from "./ThemePreview";
import { Card } from "../controls/Card";

interface ThemeCardProps {
    theme: pxt.ColorThemeInfo;
    onClick?: (theme: pxt.ColorThemeInfo) => void;
}

export class ThemeCard extends React.Component<ThemeCardProps> {
    render() {
        const { onClick, theme } = this.props;

        return (
            <Card
                className="theme-card"
                role="listitem"
                key={theme.id}
                onClick={() => onClick(theme)}
            >
                <div className="theme-info-box">
                    <ThemePreview theme={theme} />
                    <div className="theme-picker-item-name">{theme.name}</div>
                </div>
            </Card>
        );
    }
}
