import * as React from "react";
import { Button } from "../../../../react-common/components/controls/Button";

export interface ProjectToolsHeaderProps {
    title: string;
    actions?: React.ReactNode;
    pinned: boolean;
    onPinnedChange: (pinned: boolean) => void;
    onCollapse: () => void;
}

export function ProjectToolsHeader(props: ProjectToolsHeaderProps): JSX.Element {
    const { title, actions, pinned, onPinnedChange, onCollapse } = props;

    return (
        <div className="project-tools-header">
            <h2
                className="project-tools-title"
                title={title}
            >
                {title}
            </h2>
            {actions}
            <Button
                type="button"
                nativeBehavior
                className="project-tools-button project-tools-pin"
                ariaPressed={pinned}
                ariaLabel={lf("Keep project tools open")}
                title={pinned ? lf("Unpin project tools") : lf("Pin project tools open")}
                onClick={() => onPinnedChange(!pinned)}
            >
                <svg
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                    focusable="false"
                >
                    <path
                        className="project-tools-pin-head"
                        d="M8 3h8v3l-1 1v5l3 3v2H6v-2l3-3V7L8 6Z"
                    />
                    <path d="M12 17v5" />
                </svg>
            </Button>
            <Button
                type="button"
                nativeBehavior
                className="project-tools-button project-tools-close"
                title={lf("Collapse project tools")}
                ariaLabel={lf("Collapse project tools")}
                leftIcon="icon minus"
                onClick={onCollapse}
            />
        </div>
    );
}
