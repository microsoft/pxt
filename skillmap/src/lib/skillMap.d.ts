interface PageMetadata {
    title: string;
    description?: string;
    infoUrl?: string;
    backgroundImageUrl?: string;
    bannerImageUrl?: string; // Banner image in the info panel when no activity is selected
    theme?: SkillGraphTheme
    alternateSources?: string[]; // List of alternate pageSourceUrls to import user projects from
}

interface SkillMap {
    mapId: string;
    displayName: string;
    description?: string;
    prerequisites: MapPrerequisite[];
    completionUrl?: string; // DEPRECATED, urls should be specified on completion nodes

    // Indicates whether or not code can be copied from previous activity
    // for all cards in this skillmap
    allowCodeCarryover?: boolean;

    activities: {[index: string]: MapNode};
    root: MapNode;
}

type MapPrerequisite = TagPrerequisite | MapFinishedPrerequisite;

interface TagPrerequisite {
    type: "tag"
    tag: string;
    numberCompleted: number;
}

interface MapFinishedPrerequisite {
    type: "map";
    mapId: string;
}

type MapNodeKind = "activity" | "reward" | "completion" | "layout";

type MapNode = MapActivity | MapReward | MapCompletionNode | MapLayoutNode

interface BaseNode {
    kind: MapNodeKind;
    activityId: string;
    displayName: string;
    imageUrl?: string;

    next: MapNode[];
    nextIds: string[];
}

type MapActivityType = "tutorial";

interface MapActivity extends BaseNode {
    kind: "activity";
    description?: string;
    tags: string[];

    type: MapActivityType;
    editor: "blocks" | "js" | "py";

    url: string;

    // Indicates whether or not code can be copied from previous activity
    allowCodeCarryover?: boolean;
}

type MapRewardType = "certificate";

interface MapReward extends BaseNode {
    kind: "reward";
    type: MapRewardType;
    url: string;
}

interface MapCompletionNode extends MapReward {
    kind: "completion";
}

interface MapLayoutNode extends BaseNode {
    kind: "layout";
}

type CompletedTags = {[index: string]: number}

interface UserState {
    version: string;
    isDebug?: boolean;
    id: string;

    // Indexed by the skillmap page url
    mapProgress: {[index: string]: {[mapId: string]: MapState}};
    completedTags: {[index: string]: CompletedTags};
}

interface MapState {
    mapId: string;
    activityState: {[index: string]: ActivityState};
    completionState: "incomplete" | "transitioning" | "completed";
}

interface ActivityState {
    activityId: string;
    isCompleted: boolean;
    headerId?: string;
    currentStep?: number;
    maxSteps?: number;
    completedTime?: number;
}

interface SkillGraphTheme {
    backgroundColor: string;
    pathColor: string;
    strokeColor: string;
    selectedStrokeColor: string;
    unlockedNodeColor: string;
    unlockedNodeForeground: string;
    lockedNodeColor: string;
    lockedNodeForeground: string;
    completedNodeColor: string;
    completedNodeForeground: string;
    rewardNodeColor: string;
    rewardNodeForeground: string;
    pathOpacity: number;
}