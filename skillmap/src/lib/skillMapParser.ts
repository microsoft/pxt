
/// <reference path="./skillMap.d.ts" />

const testMap = ``

interface MarkdownSection {
    headerKind: "single" | "double" | "triple";
    header: string;
    attributes: {[index: string]: string};
}

export function test() {
    return parseSkillMap(testMap);
}

export function parseSkillMap(text: string): { maps: SkillMap[], metadata?: PageMetadata } {
    const sections = getSectionsFromText(text);

    const parsed: SkillMap[] = [];
    let metadata: PageMetadata | undefined;

    let start = -1;

    for (let i = 0; i < sections.length; i++) {
        if (sections[i].headerKind === "single") {
            metadata = inflateMetadata(sections[i]);
        } else if (sections[i].headerKind === "double") {
            if (start >= 0) {
                parsed.push(buildMapFromSections(sections[start], sections.slice(start + 1, i)));
            }
            start = i;
        }
    }

    if (start > 0 || parsed.length === 0) {
        parsed.push(buildMapFromSections(sections[start], sections.slice(start + 1, sections.length)));
    }

    return { maps: parsed, metadata };
}

function getSectionsFromText(text: string) {
    const lines = text.split("\n");

    let sections: MarkdownSection[] = [];
    let currentSection: MarkdownSection | null = null;

    let currentKey: string | null = null;
    let currentValue: string | null = null;

    for (const line of lines) {
        if (!line.trim()) {
            if (currentValue) {
                currentValue += "\n";
            }
            continue;
        }

        if (line.startsWith("#")) {
            const headerMatch = /^(#+)\s*(.+)$/.exec(line);

            if (headerMatch) {
                pushSection();

                currentSection = {
                    headerKind: headerMatch[1].length === 1 ? "single" :
                        (headerMatch[1].length === 2 ? "double" : "triple"),
                    header: headerMatch[2],
                    attributes: {}
                }
                currentKey = null;
                currentValue = null;
                continue;
            }
        }

        if (currentSection) {
            const keyMatch = /^[*-]\s+(?:([^:]+):)?(.*)$/.exec(line);

            if (keyMatch) {
                if (keyMatch[1]) {
                    if (currentKey && currentValue) {
                        currentSection.attributes[currentKey] = currentValue.trim();
                    }
                    currentKey = keyMatch[1].toLowerCase();
                    currentValue = keyMatch[2];
                }
                else if (currentKey) {
                    currentValue += keyMatch[2];
                }
            }
        }
    }

    pushSection();

    return sections;

    function pushSection() {
        if (currentSection) {
            if (currentKey && currentValue) {
                currentSection.attributes[currentKey] = currentValue.trim();
            }
            sections.push(currentSection);
        }
    }
}

function buildMapFromSections(header: MarkdownSection, sections: MarkdownSection[]) {
    const result = inflateSkillMap(header);
    const activities = sections.map(inflateActivity);

    result.root = activities[0];

    for (const activity of activities) {
        if (result.activities![activity.activityId]) {
            error(`Duplicate activity id '${activity.activityId}' in map '${result.mapId}'`);
        }

        result.activities![activity.activityId] = activity;
    }

    for (const activity of activities) {
        for (const id of activity.nextIds) {
            if (!result.activities![id]) error(`Unknown activity id '${id}' in map '${result.mapId}'`);
            activity.next.push(result.activities![id]);
        }
    }

    const reachable: {[index: string]: boolean} = {};

    checkForLoopsRecursive(result.root);

    for (const activity of activities) {
        if (!reachable[activity.activityId]) {
            console.warn(`Unreachable activity detected '${activity.activityId}' in map '${result.mapId}'`);
        }
    }

    return result as SkillMap;

    function checkForLoopsRecursive(root: MapActivity, visited: {[index: string]: boolean} = {}) {
        if (visited[root.activityId]) error(`Loop in map '${result.mapId}' detected`);
        visited[root.activityId] = true;
        reachable[root.activityId] = true;

        if (root.next.length > 1) {
            error("Branching currently not supported")
        }

        for (const next of root.next) {
            checkForLoopsRecursive(next, {...visited});
        }
    }
}


function inflateSkillMap(section: MarkdownSection): Partial<SkillMap> {
    const result: Partial<SkillMap> = {
        mapId: section.header.toLowerCase(),
        displayName: section.attributes["name"] || section.header,
        description: section.attributes["description"],
        completionUrl: section.attributes["completionurl"],
        prerequisites: [],
        activities: {}
    };

    if (section.attributes["required"]) {
        const parts = section.attributes["required"].split(",");
        for (const part of parts) {
            const match = /^\s*(?:(\d+) +)?(.+)$/.exec(part)!;

            if (match[1]) {
                result.prerequisites!.push({
                    type: "tag",
                    tag: match[2].trim(),
                    numberCompleted: parseInt(match[1])
                });
            }
            else {
                result.prerequisites!.push({
                    type: "map",
                    mapId: match[2].trim()
                });
            }
        }
    }

    return result;
}

function inflateActivity(section: MarkdownSection): MapActivity {
    const result: Partial<MapActivity> = {
        activityId: section.header.toLowerCase(),
        displayName: section.attributes["name"] || section.header,
        description: section.attributes["description"],
        url: section.attributes["url"],
        imageUrl: section.attributes["imageurl"],
        tags: parseList(section.attributes["tags"]),
        next: [],
        nextIds: parseList(section.attributes["next"])
    };

    if (section.attributes["type"]) {
        const type = section.attributes["type"].toLowerCase();
        switch (type) {
            case "tutorial":
                result.type = type;
                break;
        }
    }

    if (section.attributes["editor"]) {
        const editor = section.attributes["editor"].toLowerCase();
        switch (editor) {
            case "py":
            case "blocks":
            case "js":
                result.editor = editor;
                break;
            default:
                result.editor = "blocks";
        }
    }

    if (!result.url) error(`Activity '${result.activityId}' is missing attribute 'url'`);
    if (!result.type) error(`Activity '${result.activityId}' is missing attribute 'type'`);

    return result as MapActivity;
}

function inflateMetadata(section: MarkdownSection): PageMetadata {
    return {
        title: section.attributes["name"] || section.header,
        description: section.attributes["description"],
        infoUrl: section.attributes["infourl"]
    }
}

function parseList(list: string, includeDuplicates = false) {
    if (!list) return [];
    const parts = list.split(",").map(p => p.trim().toLowerCase()).filter(p => !!p);

    if (!includeDuplicates) {
        let map: {[index: string]: string} = {};
        parts.forEach(p => map[p] = p);
        return Object.keys(map);
    }
    return parts;
}

function error(message: string): never {
    throw(message);
}



