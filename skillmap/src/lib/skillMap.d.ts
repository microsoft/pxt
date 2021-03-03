interface PageMetadata {
    title: string;
    description?: string;
    infoUrl?: string;
}

interface SkillMap {
    mapId: string;
    displayName: string;
    description?: string;
    prerequisites: MapPrerequisite[];
    completionUrl?: string;

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

type MapNodeKind = "activity" | "reward" | "completion";

type MapNode = MapActivity | MapReward | MapCompletionNode

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

interface MapReward extends BaseNode {
    kind: "reward";

}

interface MapCompletionNode extends MapReward {
    kind: "completion";
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
}