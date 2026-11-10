/// <reference path="../../built/pxtlib.d.ts" />

import * as Blockly from "blockly";

/** The text or image shown for a dropdown option. */
export function getOptionContent(option: Blockly.MenuOption): string | Blockly.ImageProperties | HTMLElement {
    return option[0];
}

/** The language-neutral value a dropdown option saves, such as a qualified symbol name. */
export function getOptionValue(option: Blockly.MenuOption): string {
    return option[1];
}

/** An option's tags, combined from its image properties and the `optionTags` map, in lowercase. */
export function getGridPickerTags(option: Blockly.MenuOption, optionTags?: pxt.Map<string[]>): string[] {
    const content = getOptionContent(option);
    const contentTags = typeof content === "object" ? (content as { tags?: string[] }).tags : undefined;
    return pxt.sprite.parseTags([...(contentTags || []), ...(optionTags?.[getOptionValue(option)] || [])])
        .map(tag => tag.toLowerCase());
}

/** Keeps the options that match a tag filter such as "rider !undead". An empty filter keeps everything. */
export function filterGridPickerOptions(options: Blockly.MenuOption[], filter: string | string[], optionTags?: pxt.Map<string[]>): Blockly.MenuOption[] {
    if (!pxt.sprite.parseTags(filter).length) return options;
    const matches = pxt.sprite.compileTagFilter(filter);
    return options.filter(option => matches(getGridPickerTags(option, optionTags)));
}

export interface GridPickerGroup {
    id: string;
    name: string;
    icon?: string;
    weight?: number;
    flat?: boolean;
    options: Blockly.MenuOption[];
}

export interface GridPickerEntry {
    option: Blockly.MenuOption;
    group?: GridPickerGroup;
}

export interface GridPickerRow {
    entries: GridPickerEntry[];
    group?: GridPickerGroup;
}

/** Orders entries by weight. Group tiles use their group's weight, and loose options use their own. */
export function sortGridPickerEntries(entries: GridPickerEntry[], optionWeights?: pxt.Map<number>): GridPickerEntry[] {
    return pxt.sprite.sortByWeight(entries, entry => entry.group
        ? entry.group.weight : optionWeights?.[getOptionValue(entry.option)]);
}

/**
 * Splits entries into rows of `columns` tiles. When a group is expanded, its options go in extra rows
 * right after the row that holds its tile, so the other tiles don't shift.
 */
export function getGridPickerRows(entries: GridPickerEntry[], columns: number, expanded: ReadonlySet<string>): GridPickerRow[] {
    const rows: GridPickerRow[] = [];
    for (let i = 0; i < entries.length; i += columns) {
        const parents = entries.slice(i, i + columns);
        rows.push({ entries: parents });
        for (const parent of parents) {
            if (!parent.group || !expanded.has(parent.group.id)) continue;
            const children = parent.group.options;
            for (let j = 0; j < children.length; j += columns) {
                rows.push({
                    entries: children.slice(j, j + columns).map(option => ({ option })),
                    group: parent.group
                });
            }
        }
    }
    return rows;
}

/**
 * Works out what a tab shows for a search: the matching options, split into the catalog's groups.
 * Options that don't fall into any group come last, in a flat group of their own.
 */
export function getGridPickerGroups(
    options: Blockly.MenuOption[],
    catalog: pxt.GridPickerCatalog,
    tab: pxt.GridPickerCategory,
    search: string,
    filter?: string,
    optionTags?: pxt.Map<string[]>,
    optionWeights?: pxt.Map<number>
): GridPickerGroup[] {
    let visible = filterGridPickerOptions(options, tab.tags || [], optionTags);
    if (filter) visible = filterGridPickerOptions(visible, filter, optionTags);
    const words = (search || "").replace(/[-_]/g, " ").trim().toLowerCase().split(/\s+/).filter(word => !!word);
    visible = visible.filter(option => {
        const content = getOptionContent(option);
        const label = typeof content === "string" ? content : (content as { alt?: string }).alt || "";
        const text = [label, getOptionValue(option), ...getGridPickerTags(option, optionTags)].join(" ").toLowerCase().replace(/[-_]/g, " ");
        return words.every(word => text.indexOf(word) !== -1);
    });
    visible = pxt.sprite.sortByWeight(visible, option => optionWeights?.[getOptionValue(option)]);
    if (!visible.length) return [];
    if (tab.flat) return [{ id: "all", name: "", flat: true, options: visible }];
    const categories = catalog.groups || [];

    const claimed = new Set<string>();
    let groups: GridPickerGroup[] = [];
    for (const category of categories) {
        const members = filterGridPickerOptions(visible, category.tags || [], optionTags)
            .filter(option => !claimed.has(getOptionValue(option)));
        if (!members.length) continue;
        members.forEach(option => claimed.add(getOptionValue(option)));
        groups.push({ id: category.id, name: category.name, icon: category.icon, weight: category.weight, options: members });
    }
    groups = pxt.sprite.sortByWeight(groups, group => group.weight);
    const remaining = visible.filter(option => !claimed.has(getOptionValue(option)));
    if (remaining.length) {
        let id = "other";
        while (categories.some(category => category.id === id)) id = "_" + id;
        groups.push({ id, name: "", flat: true, options: remaining });
    }
    return groups;
}

/**
 * Returns the tallest layout any tab can produce, with its largest group expanded. The picker sizes
 * itself from this so it doesn't jump around when switching tabs.
 */
export function getGridPickerSizeRows(options: Blockly.MenuOption[], catalog: pxt.GridPickerCatalog, columns: number, optionTags?: pxt.Map<string[]>, optionWeights?: pxt.Map<number>): GridPickerRow[] {
    let largest = getGridPickerRows(options.map(option => ({ option })), columns, new Set());
    for (const tab of catalog.tabs) {
        const entries: GridPickerEntry[] = [];
        let largestGroup: GridPickerGroup;
        for (const group of getGridPickerGroups(options, catalog, tab, "", undefined, optionTags, optionWeights)) {
            if (!group.flat && group.options.length > 1 && !tab.flat) {
                entries.push({ option: group.options[0], group });
                if (!largestGroup || group.options.length > largestGroup.options.length) largestGroup = group;
            } else {
                entries.push(...group.options.map(option => ({ option })));
            }
        }
        const rows = getGridPickerRows(sortGridPickerEntries(entries, optionWeights), columns, new Set(largestGroup ? [largestGroup.id] : []));
        if (rows.length > largest.length) largest = rows;
    }
    return largest;
}

let catalogImageConverter: pxt.ImageConverter;

/**
 * Resolves a catalog icon reference, which can be a qualified symbol or a JRES ID, to an image URL.
 * Returns undefined when the reference has no usable image.
 */
export function getGridPickerCatalogIcon(apis: pxtc.ApisInfo | undefined, reference: string): string | undefined {
    const symbol = apis?.byQName[reference];
    const resource = (symbol && pxt.sprite.getSymbolResource(apis, symbol)) || apis?.jres?.[reference];
    const icon = symbol?.attributes.iconURL || resource?.icon;
    if (icon) return icon;
    if (resource?.data && pxt.Util.startsWith(resource.mimeType, "image/x-mkcd-f")) {
        if (!catalogImageConverter) catalogImageConverter = new pxt.ImageConverter();
        return catalogImageConverter.convert(`data:${resource.mimeType};base64,${resource.data}`);
    }
    return undefined;
}
