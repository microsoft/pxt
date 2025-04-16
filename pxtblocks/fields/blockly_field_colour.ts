/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview Colour input field.
 */

import * as Blockly from 'blockly/core';

/**
 * Class for a colour input field.
 */
export class FieldColour extends Blockly.Field<string> {
  /** The field's colour picker element. */
  private picker: HTMLElement | null = null;

  /** Index of the currently highlighted element. */
  private highlightedIndex: number | null = null;

  /**
   * Array holding info needed to unbind events.
   * Used for disposing.
   * Ex: [[node, name, func], [node, name, func]].
   */
  private boundEvents: Blockly.browserEvents.Data[] = [];

  /**
   * Serializable fields are saved by the serializer, non-serializable fields
   * are not.  Editable fields should also be serializable.
   */
  override SERIALIZABLE = true;

  /**
   * Used to tell if the field needs to be rendered the next time the block is
   * rendered.  Colour fields are statically sized, and only need to be
   * rendered at initialization.
   */
  // eslint-disable-next-line @typescript-eslint/naming-convention
  protected override isDirty_ = false;

  /**
   * An array of colour strings for the palette.
   * Copied from goog.ui.ColorPicker.SIMPLE_GRID_COLORS
   */
  private colours: string[] = [
    // grays
    '#ffffff',
    '#cccccc',
    '#c0c0c0',
    '#999999',
    '#666666',
    '#333333',
    '#000000',
    // reds
    '#ffcccc',
    '#ff6666',
    '#ff0000',
    '#cc0000',
    '#990000',
    '#660000',
    '#330000',
    // oranges
    '#ffcc99',
    '#ff9966',
    '#ff9900',
    '#ff6600',
    '#cc6600',
    '#993300',
    '#663300',
    // yellows
    '#ffff99',
    '#ffff66',
    '#ffcc66',
    '#ffcc33',
    '#cc9933',
    '#996633',
    '#663333',
    // olives
    '#ffffcc',
    '#ffff33',
    '#ffff00',
    '#ffcc00',
    '#999900',
    '#666600',
    '#333300',
    // greens
    '#99ff99',
    '#66ff99',
    '#33ff33',
    '#33cc00',
    '#009900',
    '#006600',
    '#003300',
    // turquoises
    '#99ffff',
    '#33ffff',
    '#66cccc',
    '#00cccc',
    '#339999',
    '#336666',
    '#003333',
    // blues
    '#ccffff',
    '#66ffff',
    '#33ccff',
    '#3366ff',
    '#3333ff',
    '#000099',
    '#000066',
    // purples
    '#ccccff',
    '#9999ff',
    '#6666cc',
    '#6633ff',
    '#6600cc',
    '#333399',
    '#330099',
    // violets
    '#ffccff',
    '#ff99ff',
    '#cc66cc',
    '#cc33cc',
    '#993399',
    '#663366',
    '#330033',
  ];

  /**
   * An array of tooltip strings for the palette.  If not the same length as
   * COLOURS, the colour's hex code will be used for any missing titles.
   */
  private titles: string[] = [];

  /**
   * Number of columns in the palette.
   */
  private columns = 7;

  /**
   * @param value The initial value of the field.  Should be in '#rrggbb'
   *     format.  Defaults to the first value in the default colour array.  Also
   *     accepts Field.SKIP_SETUP if you wish to skip setup (only used by
   *     subclasses that want to handle configuration and setting the field
   *     value after their own constructors have run).
   * @param validator A function that is called to validate changes to the
   *     field's value.  Takes in a colour string & returns a validated colour
   *     string ('#rrggbb' format), or null to abort the change.
   * @param config A map of options used to configure the field.
   *     See the [field creation documentation]{@link
   * https://developers.google.com/blockly/guides/create-custom-blocks/fields/built-in-fields/colour}
   * for a list of properties this parameter supports.
   */
  constructor(
    value?: string | typeof Blockly.Field.SKIP_SETUP,
    validator?: FieldColourValidator,
    config?: FieldColourConfig,
  ) {
    super(Blockly.Field.SKIP_SETUP);

    if (value === Blockly.Field.SKIP_SETUP) return;
    if (config) {
      this.configure_(config);
    }
    this.setValue(value);
    if (validator) {
      this.setValidator(validator);
    }
  }

  /**
   * Configure the field based on the given map of options.
   *
   * @param config A map of options to configure the field based on.
   */
  // eslint-disable-next-line @typescript-eslint/naming-convention
  protected override configure_(config: FieldColourConfig) {
    super.configure_(config);
    if (config.colourOptions) this.colours = config.colourOptions;
    if (config.colourTitles) this.titles = config.colourTitles;
    if (config.columns) this.columns = config.columns;
  }

  /**
   * Create the block UI for this colour field.
   *
   * @internal
   */
  override initView() {
    const constants = this.getConstants();
    // This can't happen, but TypeScript thinks it can and lint forbids `!.`.
    if (!constants) throw Error('Constants not found');
    this.size_ = new Blockly.utils.Size(
      constants.FIELD_COLOUR_DEFAULT_WIDTH,
      constants.FIELD_COLOUR_DEFAULT_HEIGHT,
    );
    this.createBorderRect_();
    this.getBorderRect().style['fillOpacity'] = '1';
    this.getBorderRect().setAttribute('stroke', '#fff');
    if (this.isFullBlockField()) {
      this.clickTarget_ = (this.sourceBlock_ as Blockly.BlockSvg).getSvgRoot();
    }
  }

  /**
   * Defines whether this field should take up the full block or not.
   *
   * @returns True if this field should take up the full block. False otherwise.
   */
  isFullBlockField(): boolean {
    const block = this.getSourceBlock();
    if (!block) throw new Blockly.UnattachedFieldError();

    const constants = this.getConstants();
    return (
      this.blockIsSimpleReporter() &&
      Boolean(constants?.FIELD_COLOUR_FULL_BLOCK)
    );
  }

  /**
   * @returns True if the source block is a value block with a single editable
   *     field.
   * @internal
   */
  blockIsSimpleReporter(): boolean {
    const block = this.getSourceBlock();
    if (!block) throw new Blockly.UnattachedFieldError();

    if (!block.outputConnection) return false;

    for (const input of block.inputList) {
      if (input.connection || input.fieldRow.length > 1) return false;
    }
    return true;
  }

  /**
   * Updates text field to match the colour/style of the block.
   *
   * @internal
   */
  override applyColour() {
    const block = this.getSourceBlock() as Blockly.BlockSvg | null;
    if (!block) throw new Blockly.UnattachedFieldError();

    if (!this.fieldGroup_) return;

    const borderRect = this.borderRect_;
    if (!borderRect) {
      throw new Error('The border rect has not been initialized');
    }

    if (!this.isFullBlockField()) {
      borderRect.style.display = 'block';
      borderRect.style.fill = this.getValue() as string;
    } else {
      borderRect.style.display = 'none';
      // In general, do *not* let fields control the color of blocks. Having the
      // field control the color is unexpected, and could have performance
      // impacts.
      block.pathObject.svgPath.setAttribute('fill', this.getValue() as string);
      block.pathObject.svgPath.setAttribute('stroke', '#fff');
    }
  }

  /**
   * Returns the height and width of the field.
   *
   * This should *in general* be the only place render_ gets called from.
   *
   * @returns Height and width.
   */
  override getSize(): Blockly.utils.Size {
    if (this.getConstants()?.FIELD_COLOUR_FULL_BLOCK) {
      // In general, do *not* let fields control the color of blocks. Having the
      // field control the color is unexpected, and could have performance
      // impacts.
      // Full block fields have more control of the block than they should
      // (i.e. updating fill colour) so they always need to be rerendered.
      this.render_();
      this.isDirty_ = false;
    }
    return super.getSize();
  }

  /**
   * Updates the colour of the block to reflect whether this is a full
   * block field or not.
   */
  // eslint-disable-next-line @typescript-eslint/naming-convention
  protected override render_() {
    super.render_();

    const block = this.getSourceBlock() as Blockly.BlockSvg | null;
    if (!block) throw new Blockly.UnattachedFieldError();
    // Calling applyColour updates the UI (full-block vs non-full-block) for the
    // colour field, and the colour of the field/block.
    block.applyColour();
  }

  /**
   * Updates the size of the field based on whether it is a full block field
   * or not.
   *
   * @param margin margin to use when positioning the field.
   */
  // eslint-disable-next-line @typescript-eslint/naming-convention
  protected updateSize_(margin?: number) {
    const constants = this.getConstants();
    if (!constants) return;
    let totalWidth;
    let totalHeight;
    if (this.isFullBlockField()) {
      const xOffset = margin ?? 0;
      totalWidth = xOffset * 2;
      totalHeight = constants.FIELD_TEXT_HEIGHT;
    } else {
      totalWidth = constants.FIELD_COLOUR_DEFAULT_WIDTH;
      totalHeight = constants.FIELD_COLOUR_DEFAULT_HEIGHT;
    }

    this.size_.height = totalHeight;
    this.size_.width = totalWidth;

    this.positionBorderRect_();
  }

  /**
   * Ensure that the input value is a valid colour.
   *
   * @param newValue The input value.
   * @returns A valid colour, or null if invalid.
   */
  // eslint-disable-next-line @typescript-eslint/naming-convention
  protected override doClassValidation_(
    newValue: string,
  ): string | null | undefined;
  // eslint-disable-next-line @typescript-eslint/naming-convention
  protected override doClassValidation_(newValue?: string): string | null;
  // eslint-disable-next-line @typescript-eslint/naming-convention
  protected override doClassValidation_(
    newValue?: string,
  ): string | null | undefined {
    if (typeof newValue !== 'string') {
      return null;
    }
    return Blockly.utils.colour.parse(newValue);
  }

  /**
   * Get the text for this field.  Used when the block is collapsed.
   *
   * @returns Text representing the value of this field.
   */
  override getText(): string {
    let colour = this.value_ as string;
    // Try to use #rgb format if possible, rather than #rrggbb.
    if (/^#(.)\1(.)\2(.)\3$/.test(colour)) {
      colour = '#' + colour[1] + colour[3] + colour[5];
    }
    return colour;
  }

  /**
   * Set a custom colour grid for this field.
   *
   * @param colours Array of colours for this block, or null to use default
   *     (FieldColour.COLOURS).
   * @param titles Optional array of colour tooltips, or null to use default
   *     (FieldColour.TITLES).
   * @returns Returns itself (for method chaining).
   */
  setColours(colours: string[], titles?: string[]): FieldColour {
    this.colours = colours;
    if (titles) {
      this.titles = titles;
    }
    return this;
  }

  /**
   * Set a custom grid size for this field.
   *
   * @param columns Number of columns for this block, or 0 to use default
   *     (FieldColour.COLUMNS).
   * @returns Returns itself (for method chaining).
   */
  setColumns(columns: number): FieldColour {
    this.columns = columns;
    return this;
  }

  /** Create and show the colour field's editor. */
  // eslint-disable-next-line @typescript-eslint/naming-convention
  protected override showEditor_() {
    this.dropdownCreate();
    // This can't happen, but TypeScript thinks it can and lint forbids `!.`.
    if (!this.picker) throw Error('Picker not found');
    Blockly.DropDownDiv.getContentDiv().appendChild(this.picker);

    Blockly.DropDownDiv.showPositionedByField(
      this,
      this.dropdownDispose.bind(this),
    );

    // Focus so we can start receiving keyboard events.
    this.picker.focus({preventScroll: true});
  }

  /**
   * Handle a click on a colour cell.
   *
   * @param e Mouse event.
   */
  private onClick(e: PointerEvent) {
    const cell = e.target as Element;
    const colour = cell && cell.getAttribute('data-colour');
    if (colour !== null) {
      this.setValue(colour);
      Blockly.DropDownDiv.hideIfOwner(this);
    }
  }

  /**
   * Handle a key down event.  Navigate around the grid with the
   * arrow keys.  Enter selects the highlighted colour.
   *
   * @param e Keyboard event.
   */
  private onKeyDown(e: KeyboardEvent) {
    let handled = true;
    let highlighted: HTMLElement | null;
    switch (e.key) {
      case 'ArrowUp':
        this.moveHighlightBy(0, -1);
        break;
      case 'ArrowDown':
        this.moveHighlightBy(0, 1);
        break;
      case 'ArrowLeft':
        this.moveHighlightBy(-1, 0);
        break;
      case 'ArrowRight':
        this.moveHighlightBy(1, 0);
        break;
      case 'Enter':
        // Select the highlighted colour.
        highlighted = this.getHighlighted();
        if (highlighted) {
          const colour = highlighted.getAttribute('data-colour');
          if (colour !== null) {
            this.setValue(colour);
          }
        }
        Blockly.DropDownDiv.hideWithoutAnimation();
        break;
      default:
        handled = false;
    }
    if (handled) {
      e.stopPropagation();
    }
  }

  /**
   * Move the currently highlighted position by dx and dy.
   *
   * @param dx Change of x.
   * @param dy Change of y.
   */
  private moveHighlightBy(dx: number, dy: number) {
    if (!this.highlightedIndex) {
      return;
    }

    const colours = this.colours;
    const columns = this.columns;

    // Get the current x and y coordinates.
    let x = this.highlightedIndex % columns;
    let y = Math.floor(this.highlightedIndex / columns);

    // Add the offset.
    x += dx;
    y += dy;

    if (dx < 0) {
      // Move left one grid cell, even in RTL.
      // Loop back to the end of the previous row if we have room.
      if (x < 0 && y > 0) {
        x = columns - 1;
        y--;
      } else if (x < 0) {
        x = 0;
      }
    } else if (dx > 0) {
      // Move right one grid cell, even in RTL.
      // Loop to the start of the next row, if there's room.
      if (x > columns - 1 && y < Math.floor(colours.length / columns) - 1) {
        x = 0;
        y++;
      } else if (x > columns - 1) {
        x--;
      }
    } else if (dy < 0) {
      // Move up one grid cell, stop at the top.
      if (y < 0) {
        y = 0;
      }
    } else if (dy > 0) {
      // Move down one grid cell, stop at the bottom.
      if (y > Math.floor(colours.length / columns) - 1) {
        y = Math.floor(colours.length / columns) - 1;
      }
    }

    // Move the highlight to the new coordinates.
    const cell = (this.picker as HTMLElement).childNodes[y].childNodes[
      x
    ] as Element;
    const index = y * columns + x;
    this.setHighlightedCell(cell, index);
  }

  /**
   * Handle a mouse move event.  Highlight the hovered colour.
   *
   * @param e Mouse event.
   */
  private onMouseMove(e: PointerEvent) {
    const cell = e.target as Element;
    const index = cell && Number(cell.getAttribute('data-index'));
    if (index !== null && index !== this.highlightedIndex) {
      this.setHighlightedCell(cell, index);
    }
  }

  /** Handle a mouse enter event.  Focus the picker. */
  private onMouseEnter() {
    this.picker?.focus({preventScroll: true});
  }

  /**
   * Handle a mouse leave event.  Blur the picker and unhighlight
   * the currently highlighted colour.
   */
  private onMouseLeave() {
    this.picker?.blur();
    const highlighted = this.getHighlighted();
    if (highlighted) {
      Blockly.utils.dom.removeClass(highlighted, 'blocklyColourHighlighted');
    }
  }

  /**
   * Returns the currently highlighted item (if any).
   *
   * @returns Highlighted item (null if none).
   */
  private getHighlighted(): HTMLElement | null {
    if (!this.highlightedIndex) {
      return null;
    }

    const x = this.highlightedIndex % this.columns;
    const y = Math.floor(this.highlightedIndex / this.columns);
    const row = this.picker?.childNodes[y];
    if (!row) {
      return null;
    }
    return row.childNodes[x] as HTMLElement;
  }

  /**
   * Update the currently highlighted cell.
   *
   * @param cell The new cell to highlight.
   * @param index The index of the new cell.
   */
  private setHighlightedCell(cell: Element, index: number) {
    // Unhighlight the current item.
    const highlighted = this.getHighlighted();
    if (highlighted) {
      Blockly.utils.dom.removeClass(highlighted, 'blocklyColourHighlighted');
    }
    // Highlight new item.
    Blockly.utils.dom.addClass(cell, 'blocklyColourHighlighted');
    // Set new highlighted index.
    this.highlightedIndex = index;

    // Update accessibility roles.
    const cellId = cell.getAttribute('id');
    if (cellId && this.picker) {
      Blockly.utils.aria.setState(
        this.picker,
        Blockly.utils.aria.State.ACTIVEDESCENDANT,
        cellId,
      );
    }
  }

  /** Create a colour picker dropdown editor. */
  private dropdownCreate() {
    const columns = this.columns;
    const colours = this.colours;
    const selectedColour = this.getValue();
    // Create the palette.
    const table = document.createElement('table');
    table.className = 'blocklyColourTable';
    table.tabIndex = 0;
    table.dir = 'ltr';
    Blockly.utils.aria.setRole(table, Blockly.utils.aria.Role.GRID);
    Blockly.utils.aria.setState(table, Blockly.utils.aria.State.EXPANDED, true);
    Blockly.utils.aria.setState(
      table,
      Blockly.utils.aria.State.ROWCOUNT,
      Math.floor(colours.length / columns),
    );
    Blockly.utils.aria.setState(
      table,
      Blockly.utils.aria.State.COLCOUNT,
      columns,
    );
    let row: Element | null = null;
    for (let i = 0; i < colours.length; i++) {
      if (i % columns === 0) {
        row = document.createElement('tr');
        Blockly.utils.aria.setRole(row, Blockly.utils.aria.Role.ROW);
        table.appendChild(row);
      }
      const cell = document.createElement('td');
      (row as Element).appendChild(cell);
      // This becomes the value, if clicked.
      cell.setAttribute('data-colour', colours[i]);
      cell.title = this.titles[i] || colours[i];
      cell.id = Blockly.utils.idGenerator.getNextUniqueId();
      cell.setAttribute('data-index', `${i}`);
      Blockly.utils.aria.setRole(cell, Blockly.utils.aria.Role.GRIDCELL);
      Blockly.utils.aria.setState(
        cell,
        Blockly.utils.aria.State.LABEL,
        colours[i],
      );
      Blockly.utils.aria.setState(
        cell,
        Blockly.utils.aria.State.SELECTED,
        colours[i] === selectedColour,
      );
      cell.style.backgroundColor = colours[i];
      if (colours[i] === selectedColour) {
        cell.className = 'blocklyColourSelected';
        this.highlightedIndex = i;
      }
    }

    // Configure event handler on the table to listen for any event in a cell.
    this.boundEvents.push(
      Blockly.browserEvents.conditionalBind(
        table,
        'pointerdown',
        this,
        this.onClick,
        true,
      ),
    );
    this.boundEvents.push(
      Blockly.browserEvents.conditionalBind(
        table,
        'pointermove',
        this,
        this.onMouseMove,
        true,
      ),
    );
    this.boundEvents.push(
      Blockly.browserEvents.conditionalBind(
        table,
        'pointerenter',
        this,
        this.onMouseEnter,
        true,
      ),
    );
    this.boundEvents.push(
      Blockly.browserEvents.conditionalBind(
        table,
        'pointerleave',
        this,
        this.onMouseLeave,
        true,
      ),
    );
    this.boundEvents.push(
      Blockly.browserEvents.conditionalBind(
        table,
        'keydown',
        this,
        this.onKeyDown,
        false,
      ),
    );

    this.picker = table;
  }

  /** Disposes of events and DOM-references belonging to the colour editor. */
  private dropdownDispose() {
    for (const event of this.boundEvents) {
      Blockly.browserEvents.unbind(event);
    }
    this.boundEvents.length = 0;
    this.picker = null;
    this.highlightedIndex = null;
  }

  /**
   * Construct a FieldColour from a JSON arg object.
   *
   * @param options A JSON object with options (colour).
   * @returns The new field instance.
   * @nocollapse
   * @internal
   */
  static fromJson(options: FieldColourFromJsonConfig): FieldColour {
    // `this` might be a subclass of FieldColour if that class doesn't override
    // the static fromJson method.
    return new this(options.colour, undefined, options);
  }
}

/** The default value for this field. */
FieldColour.prototype.DEFAULT_VALUE = '#ffffff';

/**
 * Register the field and any dependencies.
 */
export function registerFieldColour() {
  Blockly.fieldRegistry.register('field_colour', FieldColour);
}

/**
 * CSS for colour picker.
 */
Blockly.Css.register(`
.blocklyColourTable {
  border-collapse: collapse;
  display: block;
  outline: none;
  padding: 1px;
}

.blocklyColourTable>tr>td {
  border: 0.5px solid #888;
  box-sizing: border-box;
  cursor: pointer;
  display: inline-block;
  height: 20px;
  padding: 0;
  width: 20px;
}

.blocklyColourTable>tr>td.blocklyColourHighlighted {
  border-color: #eee;
  box-shadow: 2px 2px 7px 2px rgba(0, 0, 0, 0.3);
  position: relative;
}

.blocklyColourSelected, .blocklyColourSelected:hover {
  border-color: #eee !important;
  outline: 1px solid #333;
  position: relative;
}
`);

/**
 * Config options for the colour field.
 */
export interface FieldColourConfig extends Blockly.FieldConfig {
  colourOptions?: string[];
  colourTitles?: string[];
  columns?: number;
}

/**
 * fromJson config options for the colour field.
 */
export interface FieldColourFromJsonConfig extends FieldColourConfig {
  colour?: string;
}

/**
 * A function that is called to validate changes to the field's value before
 * they are set.
 *
 * @see {@link https://developers.google.com/blockly/guides/create-custom-blocks/fields/validators#return_values}
 * @param newValue The value to be validated.
 * @returns One of three instructions for setting the new value: `T`, `null`,
 * or `undefined`.
 *
 * - `T` to set this function's returned value instead of `newValue`.
 *
 * - `null` to invoke `doValueInvalid_` and not set a value.
 *
 * - `undefined` to set `newValue` as is.
 */
export type FieldColourValidator = Blockly.FieldValidator<string>;