export interface HomeSearchFilterSelection {
    [filterId: string]: string[];
}

export interface HomeSearchFilterOption {
    id: string;
    label: string;
}

export interface HomeSearchFilterDefinition {
    id: string;
    label: string;
    options: HomeSearchFilterOption[];
}

export interface HomeSearchFilterOptionCounts {
    [filterId: string]: pxt.Map<number>;
}

interface HomeSearchFilterRegistryEntry extends HomeSearchFilterDefinition {
    getValues: (card: pxt.CodeCard) => string[];
}

const activityTypeOptions: HomeSearchFilterOption[] = [
    { id: "tutorial", label: lf("Tutorials") },
    { id: "example", label: lf("Examples") },
    { id: "skillmap", label: lf("Skillmaps") },
    { id: "video", label: lf("Videos") },
    { id: "project", label: lf("Projects") },
    { id: "community", label: lf("Community") },
    { id: "hardware", label: lf("Hardware") },
    { id: "extension", label: lf("Extensions") },
    { id: "resource", label: lf("Resources") },
];

const languageOptions: HomeSearchFilterOption[] = [
    { id: "blocks", label: lf("Blocks") },
    { id: "js", label: lf("JavaScript") },
    { id: "py", label: lf("Python") },
];

const explicitFilterOptions: pxt.Map<HomeSearchFilterOption[]> = {
    difficulty: [
        { id: "beginner", label: lf("Beginner") },
        { id: "intermediate", label: lf("Intermediate") },
        { id: "expert", label: lf("Expert") },
    ],
    duration: [
        { id: "15-minutes", label: lf("15 minutes") },
        { id: "30-minutes", label: lf("30 minutes") },
        { id: "60-minutes", label: lf("60 minutes") },
        { id: "one-day", label: lf("One day") },
        { id: "longer", label: lf("Longer") },
    ],
    targetAge: [
        { id: "up-to-8", label: lf("Up to age 8") },
        { id: "9-12", label: lf("Ages 9-12") },
        { id: "13-18", label: lf("Ages 13-18") },
        { id: "adult", label: lf("Adult") },
    ],
};

function addUnique(values: string[], value: string) {
    if (value && values.indexOf(value) === -1) values.push(value);
}

function getActivityTypes(card: pxt.CodeCard): string[] {
    const values: string[] = [];
    const url = card.url || "";

    if (card.cardType === "file") addUnique(values, "project");
    if (/--skillmap(?:#|$)/i.test(url)) addUnique(values, "skillmap");
    if (card.youTubeId || card.youTubePlaylistId) addUnique(values, "video");
    if (card.variant) addUnique(values, "hardware");

    switch (card.cardType) {
        case "tutorial":
            addUnique(values, "tutorial");
            break;
        case "example":
        case "codeExample":
        case "sharedExample":
        case "forumExample":
            addUnique(values, "example");
            break;
        case "forumUrl":
            addUnique(values, "community");
            break;
        case "hw":
            addUnique(values, "hardware");
            break;
        case "package":
            addUnique(values, "extension");
            break;
        case "link":
            if (!values.length) addUnique(values, "resource");
            break;
    }

    if (!values.length && url) addUnique(values, "resource");

    return values;
}

function getActionEditor(cardType: pxt.CodeCardType, editor?: pxt.CodeCardEditorType): pxt.CodeCardEditorType {
    if (editor) return editor;
    if (cardType === "tutorial" || cardType === "example") return "blocks";
    if (cardType === "codeExample") return "js";
    return undefined;
}

function getLanguages(card: pxt.CodeCard): string[] {
    const values: string[] = [];
    const addAction = (cardType: pxt.CodeCardType, editor?: pxt.CodeCardEditorType) =>
        addUnique(values, getActionEditor(cardType, editor));

    addAction(card.cardType, card.editor);
    card.otherActions?.forEach(action => addAction(action.cardType || card.cardType, action.editor));

    if (!values.length && /--skillmap(?:#|$)/i.test(card.url || ""))
        addUnique(values, "blocks");

    return values;
}

function getExplicitValues(card: pxt.CodeCard, property: "difficulty" | "duration" | "targetAge"): string[] {
    const value = card[property];
    if (!value) return [];
    return Array.isArray(value) ? value : [value];
}

const filterRegistry: HomeSearchFilterRegistryEntry[] = [
    {
        id: "activityType",
        label: lf("Type"),
        options: activityTypeOptions,
        getValues: getActivityTypes,
    },
    {
        id: "language",
        label: lf("Language"),
        options: languageOptions,
        getValues: getLanguages,
    },
    {
        id: "difficulty",
        label: lf("Difficulty"),
        options: explicitFilterOptions.difficulty,
        getValues: card => getExplicitValues(card, "difficulty"),
    },
    {
        id: "duration",
        label: lf("Duration"),
        options: explicitFilterOptions.duration,
        getValues: card => getExplicitValues(card, "duration"),
    },
    {
        id: "targetAge",
        label: lf("Target age"),
        options: explicitFilterOptions.targetAge,
        getValues: card => getExplicitValues(card, "targetAge"),
    },
];

function getValidSelectedValues(definition: HomeSearchFilterRegistryEntry, selection: HomeSearchFilterSelection): string[] {
    const validOptions = definition.options.map(option => option.id);
    return (selection[definition.id] || []).filter(value => validOptions.indexOf(value) !== -1);
}

export function getAvailableHomeSearchFilters(cards: pxt.CodeCard[]): HomeSearchFilterDefinition[] {
    return filterRegistry.map(definition => {
        const availableValues: string[] = [];
        cards.forEach(card => definition.getValues(card).forEach(value => addUnique(availableValues, value)));
        const options = definition.options.filter(option => availableValues.indexOf(option.id) !== -1);
        return options.length ? { id: definition.id, label: definition.label, options } : undefined;
    }).filter(definition => !!definition);
}

export function hasActiveHomeSearchFilters(selection: HomeSearchFilterSelection): boolean {
    return filterRegistry.some(definition => getValidSelectedValues(definition, selection || {}).length > 0);
}

export function getHomeSearchFilterOptionCounts(cards: pxt.CodeCard[], selection: HomeSearchFilterSelection): HomeSearchFilterOptionCounts {
    const counts: HomeSearchFilterOptionCounts = {};

    filterRegistry.forEach(definition => {
        const otherSelections = { ...(selection || {}) };
        delete otherSelections[definition.id];
        const candidates = filterHomeSearchCards(cards, otherSelections);
        const optionCounts: pxt.Map<number> = {};

        definition.options.forEach(option => {
            optionCounts[option.id] = candidates.filter(card =>
                definition.getValues(card).indexOf(option.id) !== -1).length;
        });
        counts[definition.id] = optionCounts;
    });

    return counts;
}

export function filterHomeSearchCards<T extends pxt.CodeCard>(cards: T[], selection: HomeSearchFilterSelection): T[] {
    if (!hasActiveHomeSearchFilters(selection)) return cards;

    return cards.filter(card => filterRegistry.every(definition => {
        const selectedValues = getValidSelectedValues(definition, selection);
        if (!selectedValues.length) return true;

        const cardValues = definition.getValues(card);
        return selectedValues.some(value => cardValues.indexOf(value) !== -1);
    }));
}