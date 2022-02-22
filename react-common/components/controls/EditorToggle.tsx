import * as React from "react";
import { useState } from "react";
import { classList, ControlProps } from "../util";
import { Button } from "./Button";
import { MenuDropdown } from "./MenuDropdown";

export interface EditorToggleProps extends ControlProps {
    items: EditorToggleItem[];
    selected: number;
}

export type EditorToggleItem = BasicEditorToggleItem | DropdownEditorToggleItem;

export interface BasicEditorToggleItem {
    label: string;
    title: string;
    focusable: boolean;
    icon?: string;
    onClick: () => void;
}

export interface DropdownEditorToggleItem extends BasicEditorToggleItem {
    items: BasicEditorToggleItem[];
}


export const EditorToggle = (props: EditorToggleProps) => {
    const {
        id,
        className,
        ariaHidden,
        ariaLabel,
        role,
        items,
        selected
    } = props;

    let [expandedDropdown, setExpandedDropdown] = useState(-1);

    const handleRef = (ref: HTMLDivElement) => {
        if (!ref) return;

        if (typeof ResizeObserver !== "undefined") {
            const observer = new ResizeObserver(() => {
                updateHandlePosition();
            })
            observer.observe(ref);
        }
    }

    const onKeydown = (ev: React.KeyboardEvent) => {

    }

    let hiddenHandle: HTMLDivElement;
    let visibleHandle: HTMLDivElement;

    // You can't animate the transition between positions in a grid layout. To
    // work around this, we create two handles: one that is positoned using
    // the grid css and one that follows the other using absolute positioning.
    // The following one is the visible one, and it's animated via css

    const updateHandlePosition = () => {
        if (!hiddenHandle || !visibleHandle) return;

        const parentRect = hiddenHandle.parentElement.getBoundingClientRect();
        const fakeRect = hiddenHandle.getBoundingClientRect();
        visibleHandle.style.left = (fakeRect.left - parentRect.left) + "px";
        visibleHandle.style.width = fakeRect.width + "px";
    }
    const handleHiddenHandleRef = (ref: HTMLDivElement) => {
        hiddenHandle = ref;
        updateHandlePosition();
    }

    const handleVisibleHandleRef = (ref: HTMLDivElement) => {
        visibleHandle = ref;
        updateHandlePosition();
    }

    const columns = items.map(i => isDropdownItem(i) ? "4fr" : "3fr").join(" ");

    return (
        <div id={id}
            className={classList("common-editor-toggle", className)}
            ref={handleRef}
            role={role || "tablist"}
            aria-hidden={ariaHidden}
            aria-label={ariaLabel}
            style={{ gridTemplateColumns: columns }}>
                {items.map((item, index) => {
                    const isSelected = selected === index;
                    const isExpanded = expandedDropdown === index;
                    return (
                        <div key={index}
                            className={classList(
                                "common-editor-toggle-item",
                                isSelected && "selected",
                                isDropdownItem(item) && "common-editor-toggle-item-dropdown",
                                isExpanded && "expanded"
                            )} >
                            <ToggleButton item={item} isSelected={isSelected} onKeydown={onKeydown} />
                            { isDropdownItem(item) &&
                                <MenuDropdown
                                    id="toggle-dropdown"
                                    className="toggle-dropdown"
                                    icon="fas fa-chevron-down"
                                    title={lf("More options")}
                                    items={items.map(item => ({
                                        title: item.title,
                                        label: item.label,
                                        onClick: item.onClick,
                                        leftIcon: item.icon
                                    }))}
                                    />
                            }
                        </div>
                    );
                })}

                <div className="common-editor-toggle-handle transparent"
                    aria-hidden={true}
                    ref={handleHiddenHandleRef}
                    style={{ gridColumnStart: selected + 1, gridColumnEnd: selected + 2 }} />

                <div className="common-editor-toggle-handle"
                    aria-hidden={true}
                    ref={handleVisibleHandleRef}
                />
        </div>
    );
}

interface ToggleButtonProps {
    item: BasicEditorToggleItem;
    isSelected?: boolean;
    onKeydown: (ev: React.KeyboardEvent) => void;
}

const ToggleButton = (props: ToggleButtonProps) => {
    const { item, isSelected, onKeydown } = props;
    const { label, title, onClick, icon, focusable } = item;

    return <Button
        role={focusable ? "tab" : undefined}
        tabIndex={focusable && isSelected ? 0 : -1}
        onKeydown={onKeydown}
        label={label}
        title={title}
        onClick={onClick}
        leftIcon={icon}
        aria-selected={isSelected} />
}

function isDropdownItem(item: EditorToggleItem): item is DropdownEditorToggleItem {
    return !!(item as DropdownEditorToggleItem).items?.length
}