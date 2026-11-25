/**
 * Returns a copy of the given gallery category tags ordered alphabetically by the
 * label shown to the user, so the filter list is stable and easy to scan in any language.
 */
export function sortGalleryTags(tags: string[], getLabel: (tag: string) => string, locale?: string): string[] {
    return tags
        .map(tag => ({ tag, label: getLabel(tag) }))
        .sort((a, b) => a.label.localeCompare(b.label, locale) || a.tag.localeCompare(b.tag))
        .map(entry => entry.tag);
}
