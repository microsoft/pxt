import { classList } from "../util";
import {  Button, ButtonViewProps } from "./Button";

export interface TabListProps {
    className?: string;
    manualActivation?: boolean;
    orientation: "horizontal" | "vertical";
    selectedId: string;
    onTabSelected: (id: string) => void;
    tabs: (ButtonViewProps & {id: string, ariaControls: string})[];
}

export const TabList = (props: TabListProps) => {
    const { className, manualActivation, orientation, selectedId, onTabSelected, tabs } = props;

    const onKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
        const currentIndex = tabs.findIndex(t => t.id === document.activeElement?.id);

        if (currentIndex === -1) return;

        let newIndex: number | null = null;

        let handled = true;
        const nextKey = pxt.Util.isUserLanguageRtl() ? "ArrowLeft" : "ArrowRight";
        const prevKey = pxt.Util.isUserLanguageRtl() ? "ArrowRight" : "ArrowLeft";

        switch (e.key) {
            case nextKey:
                newIndex = (currentIndex + 1) % tabs.length;
                break;
            case prevKey:
                newIndex = (currentIndex - 1 + tabs.length) % tabs.length;
                break;
            case "Home":
                newIndex = 0;
                break;
            case "End":
                newIndex = tabs.length - 1;
                break;
            case "Enter":
            case " ":
                if (manualActivation) {
                    onTabSelected(tabs[currentIndex].id);
                }
                break;
            default:
                handled = false;
        }

        if (handled) {
            e.preventDefault();
            e.stopPropagation();
        }

        if (newIndex !== null) {
            const newTab = tabs[newIndex];

            if (newTab) {
                document.getElementById(newTab.id)?.focus();

                if (!manualActivation) {
                    onTabSelected(newTab.id);
                }
            }
        }
    }

    return (
        <div
            role="tablist"
            aria-orientation={orientation}
            className={classList("common-tab-list", className)}
            onKeyDown={onKeyDown}
        >
            {tabs.map(tab =>
                <Button
                    {...tab}
                    role="tab"
                    ariaSelected={selectedId === tab.id}
                    key={tab.id}
                    tabIndex={selectedId !== tab.id ? -1 : undefined}
                    onKeydown={onKeyDown}
                    onClick={() => onTabSelected(tab.id)}
                />
            )}
        </div>
    )
}