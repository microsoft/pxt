import * as Blockly from "blockly";
import { isImageProperties } from "../../fields";

// This is the same as showEditor_ and dropdownCreate in field_dropdown
// except that it supports separators between dropdown menu items
export function showEditorMixin(this: Blockly.FieldDropdown, e?: MouseEvent) {
    const block = this.getSourceBlock();
    if (!block) {
        throw new Blockly.UnattachedFieldError();
    }

    const menu = new Blockly.Menu();
    menu.setRole(Blockly.utils.aria.Role.LISTBOX);
    this.menu_ = menu;

    const options = this.getOptions(false);
    let selectedMenuItem = null;

    const handleMenuActionEvent = (menuItem: Blockly.MenuItem) => {
        Blockly.DropDownDiv.hideIfOwner(this, true);
        this.onItemSelected_(this.menu_ as Blockly.Menu, menuItem);
    }

    for (let i = 0; i < options.length; i++) {
        const [label, value] = options[i];

        if (value === "SEPARATOR") {
            const menuItem = new HorizontalRuleMenuItem("");
            menu.addChild(menuItem);
            continue;
        }

        const content = (() => {
            if (isImageProperties(label)) {
                // Convert ImageProperties to an HTMLImageElement.
                const image = new Image(label.width, label.height);
                image.src = label.src;
                image.alt = label.alt || '';
                return image;
            }
            return label;
        })();

        const menuItem = new Blockly.MenuItem(content, value as string);
        menuItem.setRole(Blockly.utils.aria.Role.OPTION);
        menuItem.setRightToLeft(block.RTL);
        menuItem.setCheckable(true);
        menu.addChild(menuItem);
        menuItem.setChecked(value === this.value_);
        menuItem.onAction(handleMenuActionEvent, this);
        if (value === this.value_) {
            selectedMenuItem = menuItem;
        }
    }

    if (e && typeof e.clientX === 'number') {
        this.menu_!.openingCoords = new Blockly.utils.Coordinate(e.clientX, e.clientY);
    } else {
        this.menu_!.openingCoords = null;
    }

    Blockly.DropDownDiv.clearContent();
    Blockly.DropDownDiv.getContentDiv().style.height = "";
    const menuElement = this.menu_!.render(Blockly.DropDownDiv.getContentDiv());
    Blockly.utils.dom.addClass(menuElement, 'blocklyDropdownMenu');


    if (this.getConstants()!.FIELD_DROPDOWN_COLOURED_DIV) {
        const primaryColour = block.getColour();
        const borderColour = (this.sourceBlock_ as Blockly.BlockSvg).style.colourTertiary;
        Blockly.DropDownDiv.setColour(primaryColour, borderColour);
    }

    Blockly.DropDownDiv.showPositionedByField(this, this.dropdownDispose_.bind(this));
    Blockly.DropDownDiv.getContentDiv().style.height = `${this.menu_.getSize().height}px`;

    // Focusing needs to be handled after the menu is rendered and positioned.
    // Otherwise it will cause a page scroll to get the misplaced menu in
    // view. See issue #1329.
    this.menu_!.focus();

    if (selectedMenuItem) {
        this.menu_.setHighlighted(selectedMenuItem);
    }

    this.applyColour();
}


class HorizontalRuleMenuItem extends Blockly.MenuItem {
    element_: Element;

    createDom(): Element {
        const element = document.createElement('div');
        element.id = Blockly.utils.idGenerator.getNextUniqueId();
        this.element_ = element;

        element.className = "blockly-menuseparator";
        element.setAttribute("role", "separator");

        return element;
    }

    getElement(): Element {
        return this.element_;
    }

    getId(): string {
        return this.element_.id;
    }

    isEnabled(): boolean {
        return false;
    }
}

Blockly.Css.register(`
.blockly-menuseparator {
    border-top: 1px solid rgba(0, 0, 0, 0.2);
    margin: 4px 0;
    padding: 0;
}
`);