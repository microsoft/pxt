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


    const hasDropdown = items.some(item => isDropdownItem(item));

    const onKeydown = (ev: React.KeyboardEvent) => {
        // TODO
    }

    return (
        <div id={id}
            className={classList("common-editor-toggle", hasDropdown && "has-dropdown", className)}
            role={role || "tablist"}
            aria-hidden={ariaHidden}
            aria-label={ariaLabel}>
                {items.map((item, index) => {
                    const isSelected = selected === index;
                    return (
                        <div key={index}
                            className={classList(
                                "common-editor-toggle-item",
                                isSelected && "selected",
                                isDropdownItem(item) && "common-editor-toggle-item-dropdown",
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

                <div className="common-editor-toggle-handle"
                    aria-hidden={true}
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