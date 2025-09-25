
/// <reference path="./skillMap.d.ts" />
import MarkdownSection = pxt.MarkdownSection;

const testMap = ``

export function test() {
    return parseSkillMap(testMap);
}

export function parseSkillMap(text: string): { maps: SkillMap[], metadata?: PageMetadata } {
    const sections = pxt.getSectionsFromMarkdownMetadata(text);
    if (!sections?.length) error(`Cannot parse content: ${text}`)

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

function buildMapFromSections(header: MarkdownSection, sections: MarkdownSection[]) {
    const result = inflateSkillMap(header);
    const nodes = sections.map(inflateMapNode);
    const activities = nodes.filter(n => n.kind === "activity") as MapActivity[];

    // Inherit unless explicitly disallowed
    if (result.allowCodeCarryover) activities.forEach(a => {
        if (a.allowCodeCarryover === undefined) {
            a.allowCodeCarryover = true;
        }
    });

    result.root = nodes[0];

    for (const activity of nodes) {
        if (result.activities![activity.activityId]) {
            error(`Duplicate activity id '${activity.activityId}' in map '${result.mapId}'`);
        }

        result.activities![activity.activityId] = activity;
    }

    for (const activity of nodes) {
        for (const id of activity.nextIds) {
            if (!result.activities![id]) error(`Unknown activity id '${id}' in map '${result.mapId}'`);
            activity.next.push(result.activities![id]);
        }
    }

    const reachable: {[index: string]: boolean} = {};

    checkForLoopsRecursive(result.root);

    for (const activity of nodes) {
        if (!reachable[activity.activityId]) {
            console.warn(`Unreachable activity detected '${activity.activityId}' in map '${result.mapId}'`);
        }
    }

    return result as SkillMap;

    function checkForLoopsRecursive(root: MapNode, visited: {[index: string]: boolean} = {}) {
        if (visited[root.activityId]) {
            console.warn(`Loop in map '${result.mapId}' detected`);
            return;
        }

        visited[root.activityId] = true;
        reachable[root.activityId] = true;

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
        activities: {},
        // defaults to true
        allowCodeCarryover: section.attributes["allowcodecarryover"] ? !isFalse(section.attributes["allowcodecarryover"]) : true
    };

    if (section.attributes["layout"] === "manual") result["layout"] = "manual";

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

function inflateMapNode(section: MarkdownSection): MapNode {
    const base: Partial<MapNode> = {
        activityId: section.header.toLowerCase(),
        imageUrl: section.attributes["imageurl"],
        next: [],
        displayName: section.attributes["name"] || section.header,
        nextIds: parseList(section.attributes["next"])
    }

    if (section.attributes["position"]) {
        const coord = section.attributes["position"].split(" ");
        base.position = { depth: parseInt(coord[0]) || 0, offset: parseInt(coord[1]) || 0 };
    }

    if (section.attributes["edges"]) {
        base.edges = [];
        const edges = parseList(section.attributes["edges"], false, ";");
        base.nextIds?.forEach((next, i) => {
            const points = parseList(edges[i]) || [];
            base.edges?.push(points.map(p => {
                const coord = p.split(" ");
                return { depth: parseInt(coord[0]) || 0, offset: parseInt(coord[1]) || 0 };
            }))
        })
    }

    if (section.attributes.kind === "reward" || section.attributes.kind === "completion") {
        return inflateMapReward(section, base as Partial<MapRewardNode>);
    } else if (section.attributes.kind === "layout") {
        return inflateMapLayout(section, base as Partial<MapLayoutNode>);
    } else {
        return inflateActivity(section, base as Partial<MapActivity>);
    }
}

function inflateMapLayout(section: MarkdownSection, base: Partial<MapLayoutNode>): MapLayoutNode {
    const result: Partial<MapLayoutNode> = {
        ...base,
        kind: "layout",
        next: []
    };

    return result as MapLayoutNode;
}

function inflateMapReward(section: MarkdownSection, base: Partial<MapRewardNode>): MapRewardNode {
    const result: Partial<MapRewardNode> = {
        ...base,
        kind: (section.attributes.kind || "reward") as any,
    };

    if (section.attributes["type"]) {
        const type = section.attributes["type"].toLowerCase();
        switch (type) {
            case "certificate":
                if (!result.rewards) result.rewards = [];
                result.rewards?.push({
                    type: "certificate",
                    url: section.attributes["url"]
                })
                break;
        }
    }

    if (section.listAttributes?.["actions"]) {
        const parsedActions: MapCompletionAction[] = [];
        const actions = section.listAttributes["actions"].items.filter(a => typeof a === "string") as string[];
        for (const action of actions) {
            let [kind, ...rest] = action.split(":");
            const valueMatch = /\s*\[\s*(.*)\s*\](?:\(([^\s]+)\))?/gi.exec(rest.join(":"));
            const label = valueMatch?.[1];
            const link = valueMatch?.[2];
            switch (kind) {
                case "activity":
                    parsedActions.push({kind: "activity", label, activityId: link });
                    break;
                case "map":
                    if (link) {
                        let prefix = validGithubUrl(link) ? "github" : (validDocsUrl(link) ? "docs" : undefined);
                        if (!prefix) error(`URL: ${link} must be to Github or MakeCode documentation`);
                        parsedActions.push({ kind: "map", label, url: `#${prefix}:${link}` });
                    }
                    break;
                case "tutorial":
                    if (link) {
                        if (!validGithubUrl(link) && !validDocsUrl(link)) error(`URL: ${link} must be to Github or MakeCode documentation`);
                        parsedActions.push({ kind: "tutorial", label, url: `/#tutorial:${link}` });
                    }
                    break;
                case "docs":
                    if (link) {
                        let docsUrl = (link.startsWith("/") ? "" : "/") + link;
                        if (!validDocsUrl(docsUrl)) error(`URL: ${docsUrl} must be to MakeCode documentation`);
                        parsedActions.push({ kind: "docs", label, url: docsUrl });
                    }
                    break;
                case "editor":
                    parsedActions.push({ kind: "editor", label });
                    break;
            }
        }
        if (parsedActions.length) result.actions = parsedActions;
    }

    if (section.listAttributes?.["rewards"]) {
        const parsedRewards: MapReward[] = [];
        const rewards = section.listAttributes["rewards"];
        for (const reward of rewards.items) {
            if (typeof reward === "string") {
                let [kind, ...value] = reward.split(":");

                switch (kind) {
                    case "certificate":
                        parsedRewards.push({
                            type: "certificate",
                            url: value.join(":").trim()
                        });
                        break;
                    case "completion-badge":
                        parsedRewards.push({
                            type: "completion-badge",
                            imageUrl: value.join(":").trim()
                        });
                        break;
                }
            }
            else {
                if (reward.key === "certificate") {
                    const props = reward.items.filter(i => typeof i === "string") as string[]
                    const cert: Partial<MapRewardCertificate> = {
                        type: "certificate",
                    };

                    for (const prop of props) {
                        let [kind, ...value] = prop.split(":");

                        if (kind === "url") cert.url = value.join(":").trim();
                        if (kind === "previewurl" || kind === "preview") cert.previewUrl = value.join(":").trim();
                    }

                    if (!cert.url) error(`Certificate in activity ${section.header} is missing url attribute`);
                    parsedRewards.push(cert as MapRewardCertificate);
                }
                else if (reward.key === "completion-badge") {
                    const props = reward.items.filter(i => typeof i === "string") as string[]
                    const badge: Partial<MapCompletionBadge> = {
                        type: "completion-badge",
                    };

                    for (const prop of props) {
                        let [kind, ...value] = prop.split(":");

                        if (kind === "imageurl" || kind === "image") badge.imageUrl = value.join(":").trim();
                        if (kind === "displayname" || kind === "name") badge.displayName = value.join(":").trim();
                    }

                    if (!badge.imageUrl) error(`completion-badge in activity ${section.header} is missing imageurl attribute`);
                    parsedRewards.push(badge as MapCompletionBadge);
                }
            }
        }

        const priority = ["completion-badge", "certificate"];
        parsedRewards.sort((a, b) => priority.indexOf(a.type) - priority.indexOf(b.type));

        if (parsedRewards.length) result.rewards = parsedRewards;
    }

    if ((result as any as MapCompletionNode).kind === "completion") {
        (result as any as MapCompletionNode).showMultiplayerShare = isTrue(section.attributes["showmultiplayershare"]);
    }

    return result as MapRewardNode;
}

function inflateActivity(section: MarkdownSection, base: Partial<MapActivity>): MapActivity {
    const result: Partial<MapActivity> = {
        ...base,
        kind: "activity",
        description: section.attributes["description"],
        url: section.attributes["url"],
        tags: parseList(section.attributes["tags"]),
        // defaults to true
        allowCodeCarryover: section.attributes["allowcodecarryover"] ? !isFalse(section.attributes["allowcodecarryover"]) : true
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

function isTrue(value: string | undefined) {
    if (!value) return false;

    switch (value.toLowerCase().trim()) {
        case "1":
        case "yes":
        case "y":
        case "on":
        case "true":
            return true;
        default:
            return false;
    }
}

function isFalse(value: string | undefined) {
    if (!value) return false;

    switch (value.toLowerCase().trim()) {
        case "0":
        case "no":
        case "n":
        case "off":
        case "false":
            return true;
        default:
            return false;
    }
}

function inflateMetadata(section: MarkdownSection): PageMetadata {
    const primary = section.attributes["primarycolor"];
    const secondary = section.attributes["secondarycolor"];
    const tertiary = section.attributes["tertiarycolor"];
    const highlight = section.attributes["highlightcolor"];

    const unlockedNodeColor = section.attributes["unlockednodecolor"];
    const lockedNodeColor = section.attributes["lockednodecolor"];
    const completedNodeColor = section.attributes["completednodecolor"];

    return {
        title: section.attributes["name"] || section.header,
        description: section.attributes["description"],
        infoUrl: cleanInfoUrl(section.attributes["infourl"]),
        backgroundImageUrl: section.attributes["backgroundurl"],
        pixelatedBackground: isTrue(section.attributes["pixelatedbackground"]),
        bannerImageUrl: section.attributes["bannerurl"],
        alternateSources: parseList(section.attributes["alternatesources"]),
        theme: {
            /* Many of these remain hard-coded because their interaction with the fixed
            background image is more important than the main site theme */
            backgroundColor: tertiary || "var(--pxt-target-background1)",
            pathColor: primary || "#BFBFBF",
            strokeColor: "#000000",
            rewardNodeColor: highlight || "var(--pxt-primary-background)",
            rewardNodeForeground: highlight ? getContrastingColor(highlight) : "#000000",
            unlockedNodeColor: unlockedNodeColor || secondary || "var(--pxt-secondary-background)",
            unlockedNodeForeground: (unlockedNodeColor || secondary) ? getContrastingColor(unlockedNodeColor || secondary) : "#000000",
            lockedNodeColor: lockedNodeColor || primary || "#BFBFBF",
            lockedNodeForeground: (lockedNodeColor || primary) ? getContrastingColor(lockedNodeColor || primary) : "#000000",
            completedNodeColor: completedNodeColor || secondary || "var(--pxt-secondary-background)",
            completedNodeForeground: (completedNodeColor || secondary) ? getContrastingColor(completedNodeColor || secondary) : "#000000",
            selectedStrokeColor: highlight || "var(--pxt-primary-background)",
            pathOpacity: 0.5,
        }
    }
}

function getContrastingColor(color: string) {
    color = color.replace("#", "");
    const r = Number.parseInt(color.slice(0, 2), 16);
    const g = Number.parseInt(color.slice(2, 4), 16);
    const b = Number.parseInt(color.slice(4), 16);

    if (r + g + b > 0xff * 3 / 2) {
        return "#000000"
    }
    else {
        return "#ffffff"
    }
}

function validGithubUrl(url: string) {
    return url.match(/^(https?:\/\/)?(www\.)?github\.com\//gi);
}

function validDocsUrl(url: string) {
    return url.indexOf(".") < 0;
}

function cleanInfoUrl(url?: string) {
    // No info URL provided
    if (!url) return undefined;

    // Valid URL to Github (eg a README)
    if (validGithubUrl(url)) return url.replace(/\?[\s\S]+$/gi, "");

    // Valid URL to MakeCode docs
    if (validDocsUrl(url)) return `${url.startsWith("/") ? "" : "/"}${url}`;

    error(`URL: ${url} must be to Github or MakeCode documentation`);
}

function parseList(list: string, includeDuplicates = false, separator = ",") {
    if (!list) return [];
    const parts = list.split(separator).map(p => p.trim().toLowerCase()).filter(p => !!p);

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
