import * as Blockly from "blockly";
import { FieldDropdown } from "./field_dropdown";
import { PointerCoords, UserInputAction } from "./field_utils";


export abstract class FieldDropdownGrid extends FieldDropdown {
    public isFieldCustom_ = true;
    // Width in pixels
    protected width_: number;
    // Columns in grid
    protected columns_: number;
    // Number of rows to display (if there are extra rows, the grid will be scrollable)
    protected maxRows_: number;
    protected backgroundColour_: string;
    protected borderColour_: string;

    // Properties for grid keyboard controls
    protected activeDescendantIndex: number | undefined;
    protected gridItems: HTMLDivElement[] = [];
    protected openingPointerCoords: PointerCoords | undefined;
    protected lastUserInputAction: UserInputAction | undefined;
    protected keyDownBinding: Blockly.browserEvents.Data | null = null;
    protected pointerMoveBinding: Blockly.browserEvents.Data | null = null;

    /**
     * Callback for when a grid item is clicked inside the dropdown or widget div.
     * Should be bound to the FieldIconMenu.
     * @param {string | null} value the value to set for the field
     * @protected
     */
    protected abstract buttonClickAndClose_(value: string | null): void;

    /**
     * Callback for when a grid item is highlighted using keyboard navigation.
     * Use this method to classNames for grid items and scroll to the highlighted item if required.
     * @param {HTMLElement} gridItemContainer the HTMLElement containing the grid items
     * @protected
     */
    protected abstract setFocusedItem_(gridItemContainer: HTMLElement): void;

    private setFocusedItem(gridItemContainer: HTMLElement, e: KeyboardEvent) {
        this.lastUserInputAction = 'keymove';
        this.setFocusedItem_(gridItemContainer);
        gridItemContainer.setAttribute('aria-activedescendant', ":" + this.activeDescendantIndex);
        e.preventDefault();
        e.stopPropagation();
    }

    /**
     * Set openingPointerCoords if the Event is a PointerEvent.
     * @param {Event} e the event that triggered showEditor_
     * @protected
     */
    protected setOpeningPointerCoords(e: Event) {
        if (!e) {
            return;
        }
        const {pageX, pageY} = e as PointerEvent;
        if (pageX !== undefined && pageY !== undefined) {
            this.openingPointerCoords = {
                x: pageX,
                y: pageY
            }
        }
    }

    protected addKeyDownHandler(gridItemContainer: HTMLElement) {
        this.keyDownBinding = Blockly.browserEvents.bind(gridItemContainer, 'keydown', this, (e: KeyboardEvent) => {
            if (this.activeDescendantIndex === undefined) {
                if (e.code === 'ArrowDown' || e.code === 'ArrowRight' || e.code === 'Home' ) {
                    this.activeDescendantIndex = 0;
                    return this.setFocusedItem(gridItemContainer, e);
                } else if (e.code === 'ArrowUp' || e.code === 'ArrowLeft' || e.code === 'End') {
                    this.activeDescendantIndex =  this.gridItems.length - 1;
                    return this.setFocusedItem(gridItemContainer, e);
                }
            }

            const ctrlCmd = pxt.BrowserUtils.isMac() ? e.metaKey : e.ctrlKey;
            switch(e.code) {
                case 'ArrowUp':
                    if (this.activeDescendantIndex - this.columns_ >= 0) {
                        this.activeDescendantIndex -= this.columns_;
                    }
                    break;
                case 'ArrowDown':
                    if (this.activeDescendantIndex + this.columns_ < this.gridItems.length) {
                        this.activeDescendantIndex += this.columns_;
                    }
                    break;
                case 'ArrowRight':
                    if (this.activeDescendantIndex < this.gridItems.length - 1) {
                        this.activeDescendantIndex++;
                    }
                    break;
                case 'ArrowLeft':
                    if (this.activeDescendantIndex !== 0) {
                        this.activeDescendantIndex--;
                    }
                    break;
                case "Home": {
                    if (ctrlCmd) {
                        this.activeDescendantIndex = 0;
                    } else {
                        while (this.activeDescendantIndex % this.columns_ !== 0) {
                            this.activeDescendantIndex--;
                        }
                    }
                    break;
                }
                case "End": {
                    if (ctrlCmd) {
                        this.activeDescendantIndex = this.gridItems.length - 1;
                    } else {
                        while (
                          this.activeDescendantIndex % this.columns_ !== this.columns_ - 1 &&
                          this.activeDescendantIndex < this.gridItems.length - 1
                        ) {
                          this.activeDescendantIndex++;
                        }
                    }
                    break;
                }
                case "Enter":
                case "Space": {
                    this.buttonClickAndClose_(this.gridItems[this.activeDescendantIndex].getAttribute('data-value'));
                    e.preventDefault();
                    e.stopPropagation();
                    return;
                }
                default: {
                    return;
                }
            }
            this.setFocusedItem(gridItemContainer, e);
        });
    }

    protected addPointerListener(parentDiv: HTMLElement) {
        this.pointerMoveBinding = Blockly.browserEvents.bind(parentDiv, 'pointermove', this, () => {
            this.lastUserInputAction = 'pointermove';
        });
    }

    protected pointerMoveTriggeredByUser() {
        return this.openingPointerCoords && !this.lastUserInputAction || this.lastUserInputAction === 'pointermove';
    }

    protected pointerOutTriggeredByUser() {
        return this.lastUserInputAction === 'pointermove';
    }

    protected disposeGrid(): void {
        Blockly.browserEvents.unbind(this.keyDownBinding);
        Blockly.browserEvents.unbind(this.pointerMoveBinding);
        this.keyDownBinding = null;
        this.pointerMoveBinding = null;
        this.openingPointerCoords = undefined;
        this.lastUserInputAction = undefined;
        this.activeDescendantIndex = undefined;
        this.gridItems = [];
    }
}