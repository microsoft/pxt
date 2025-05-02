import * as React from "react";
import { classList, ControlProps } from "../util";
import { Button } from "./Button";
import { FocusList } from "./FocusList";
import { MenuDropdown } from "./MenuDropdown";
import { useState } from "react";

export interface EditorToggleProps extends ControlProps {
    items: EditorToggleItem[];
    selected: number;
    id: string;
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


    const [focusedItem, setFocusedItem] = useState<number | undefined>(undefined);
    const hasDropdown = items.some(item => isDropdownItem(item));

    const onKeydown = (ev: React.KeyboardEvent) => {
        // TODO
    }

    return (
        <div className="common-editor-toggle-outer">
            <EditorToggleAccessibleMenu
            onItemReceivedFocus={setFocusedItem}
            { ...props} />
            <div id={id}
                className={classList("common-editor-toggle", hasDropdown && "has-dropdown", className)}
                role={role || "tablist"}
                aria-hidden={true}
                aria-label={ariaLabel}>
                    {items.map((item, index) => {
                        const isSelected = selected === index;
                        const isFocused = focusedItem === index;
                        return (
                            <div key={index}
                                className={classList(
                                    "common-editor-toggle-item",
                                    isSelected && "selected",
                                    isDropdownItem(item) && "common-editor-toggle-item-dropdown",
                                    isFocused && "focused"
                                )} >
                                <ToggleButton item={item} isSelected={isSelected} onKeydown={onKeydown} />
                                { isDropdownItem(item) &&
                                    <MenuDropdown
                                        id="toggle-dropdown"
                                        className="toggle-dropdown"
                                        icon="fas fa-chevron-down"
                                        title={lf("More options")}
                                        tabIndex={-1}
                                        ariaHidden={true}
                                        items={item.items.map(item => ({
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
        </div>
    );
}

interface ToggleButtonProps {
    item: BasicEditorToggleItem;
    isSelected?: boolean;
    isFocused?: boolean;
    onKeydown: (ev: React.KeyboardEvent) => void;
}

const ToggleButton = (props: ToggleButtonProps) => {
    const { item, isSelected, onKeydown } = props;
    const { label, title, onClick, icon, focusable } = item;

    return <Button
        className={icon ? undefined : "no-icon"}
        role={focusable ? "tab" : undefined}
        tabIndex={-1}
        onKeydown={onKeydown}
        label={label}
        title={title}
        onClick={onClick}
        leftIcon={icon}
        ariaHidden={true}
        />
}


interface ToggleTab extends BasicEditorToggleItem {
    selected?: boolean;
}

interface EditorToggleAccessibleProps extends EditorToggleProps {
    onItemReceivedFocus: (index: number) => void;
}

const EditorToggleAccessibleMenu = (props: EditorToggleAccessibleProps) => {
    const { items, id, selected, ariaHidden, onItemReceivedFocus } = props;

    let selectedIndex : number | undefined;
    const tabs = items.reduce((prev, current, index) => {
        const next: ToggleTab[] = [...prev]
        next.push({...current});

        // The selected item will always be a top-level option, not in a dropdown
        if (selected === index) {
            next[next.length - 1].selected = true;
            selectedIndex = index;
        } else {
            next[next.length - 1].selected = false;
        }

        if (isDropdownItem(current)) {
            next.push(...current.items.filter(i => i.focusable))
        }
        return next;
    }, [] as ToggleTab[]);

    const childIdPrefix = `${id}-option-`
    
    return <FocusList 
            id={id} 
            role="tablist" 
            className="common-toggle-accessibility" 
            childTabStopId={`${childIdPrefix}${selectedIndex}`}
            onItemReceivedFocus={(item) => props.onItemReceivedFocus(parseInt(item.id.substring(childIdPrefix.length)))}
        >
        {tabs.map((item, index) =>
            <Button
                key={index}
                className={item.selected ? "selected" : undefined}
                id={`${childIdPrefix}${index}`}
                role="tab"
                title={item.title}
                label={item.label}
                onClick={item.onClick}
                onFocus={() => onItemReceivedFocus(selectedIndex)}
                onBlur={() => onItemReceivedFocus(undefined)}
                ariaSelected={item.selected}
                ariaHidden={ariaHidden}/>
        )}
    </FocusList>
}

function isDropdownItem(item: EditorToggleItem): item is DropdownEditorToggleItem {
    return !!(item as DropdownEditorToggleItem).items?.length
}