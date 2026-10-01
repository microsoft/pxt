import * as React from "react";
import { Button } from "../../../../react-common/components/controls/Button";
import { Input } from "../../../../react-common/components/controls/Input";
import { TabList } from "../../../../react-common/components/controls/TabList";

export interface BackpackToolbarProps {
    assetsEnabled: boolean;
    codeUnavailable: boolean;
    kind: pxt.auth.BackpackKind;
    query: string;
    pending: boolean;
    searchDisabled: boolean;
    searchInputRef: React.RefObject<HTMLInputElement>;
    kindButtonsRef: React.MutableRefObject<HTMLElement[]>;
    renderHeader: (title: string, actions?: React.ReactNode) => React.ReactNode;
    onKindChange: (kind: pxt.auth.BackpackKind) => void;
    onQueryChange: (query: string) => void;
    onClearSearch: () => void;
}

export function BackpackToolbar(props: BackpackToolbarProps): JSX.Element {
    const {
        assetsEnabled, codeUnavailable, kind, query, pending, searchDisabled,
        searchInputRef, kindButtonsRef, renderHeader, onKindChange, onQueryChange, onClearSearch
    } = props;

    const onSearchKeyDown = (event: React.KeyboardEvent<HTMLDivElement>): void => {
        if (event.key !== "Escape" || !query || event.nativeEvent.isComposing) return;

        event.preventDefault();
        event.stopPropagation();
        onClearSearch();
    };

    const tabs = assetsEnabled && (
        <TabList
            className="project-backpack-tabs"
            ariaLabel={lf("Backpack contents")}
            orientation="horizontal"
            nativeBehavior
            selectedId={`project-backpack-tab-${kind}`}
            onTabSelected={id => onKindChange(id === "project-backpack-tab-asset" ? "asset" : "code")}
            tabs={(["code", "asset"] as const).map((value, index) => ({
                id: `project-backpack-tab-${value}`,
                buttonRef: element => { kindButtonsRef.current[index] = element; },
                className: "project-backpack-button",
                type: "button",
                ariaControls: "project-backpack-items",
                hardDisabled: pending,
                label: value === "code" ? lf("Code") : lf("Assets"),
                title: value === "code" ? lf("Code") : lf("Assets")
            }))}
        />
    );

    return (
        <>
            {renderHeader(lf("Backpack"), tabs)}
            {!codeUnavailable && (
                <div
                    className="project-backpack-search"
                    role="search"
                    aria-label={lf("Backpack")}
                    onKeyDown={onSearchKeyDown}
                >
                    <Input
                        id="project-backpack-search"
                        className="project-backpack-search-input"
                        type="search"
                        role="searchbox"
                        ariaLabel={lf("Search backpack")}
                        placeholder={lf("Search backpack")}
                        icon="icon search"
                        initialValue={query}
                        onChange={onQueryChange}
                        handleInputRef={searchInputRef}
                        disabled={searchDisabled}
                    />
                    {!!query && (
                        <Button
                            className="project-backpack-button project-backpack-icon-button"
                            type="button"
                            nativeBehavior
                            onClick={onClearSearch}
                            ariaLabel={lf("Clear backpack search")}
                            title={lf("Clear backpack search")}
                            leftIcon="icon remove"
                        />
                    )}
                </div>
            )}
        </>
    );
}
