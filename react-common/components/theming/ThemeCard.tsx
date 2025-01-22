
import * as React from "react";
import { Button } from "../controls/Button";
import { ThemeInfo } from "./themeManager";
import { ThemePreview } from "./ThemePreview";

interface ThemeCardProps {
    theme: ThemeInfo;
    onClick?: (theme: ThemeInfo) => void;
}

export class ThemeCard extends React.Component<ThemeCardProps> {
    render() {
        const { onClick, theme } = this.props;

        return (
            <div key={theme.id} className="theme-picker-item">
                <Button
                    className="ui card link card-selected theme-card"
                    role="listitem"
                    title={theme.name}
                    onClick={() => onClick(theme)}
                    label={
                        <div className="theme-info-box">
                            <ThemePreview theme={theme} />
                            <div className="theme-picker-item-name">{theme.name}</div>
                        </div>
                    }
                />
            </div>
        );
    }
}
