interface PageMetadata {
    title: string;
    description?: string;
    infoUrl?: string;
    backgroundImageUrl?: string;
    pixelatedBackground?: boolean;
    bannerImageUrl?: string; // Banner image in the info panel when no activity is selected
    theme?: SkillGraphTheme
    alternateSources?: string[]; // List of alternate pageSourceUrls to import user projects from
    introductoryModal?: string; // Text content for a modal that displays when a skillmap that has not been started is visited
}

interface SkillMap {
    mapId: string;
    displayName: string;
    description?: string;
    prerequisites: MapPrerequisite[];
    allowCodeCarryover?: boolean; // Indicates if code can be copied from previous activity for all cards in this skillmap
    layout?: "ortho" | "manual"; // The graph layout system to use. Defaults to "ortho"

    activities: {[index: string]: MapNode};
    root: MapNode;

    completionUrl?: string; // DEPRECATED, urls should be specified on completion nodes
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

type MapNode = MapActivity | MapRewardNode | MapCompletionNode | MapLayoutNode

interface BaseNode {
    kind: MapNodeKind;
    activityId: string;
    displayName: string;
    imageUrl?: string;

    next: MapNode[];
    nextIds: string[];

    position?: GraphCoord; // INTERNAL: The (depth, offset) position of the node, for manually laid out graphs
    edges?: GraphCoord[][]; // INTERNAL: A list of edges, where each edge is a list of (depth, offset) points
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

type MapReward = MapRewardCertificate | MapCompletionBadge;

interface MapRewardCertificate {
    type: "certificate";
    url: string;
    previewUrl?: string;
}

interface MapCompletionBadge {
    type: "completion-badge";
    imageUrl: string;
    displayName?: string;
}

interface MapRewardNode extends BaseNode {
    kind: "reward";
    rewards: MapReward[];
    actions: MapCompletionAction[];
}

interface MapCompletionNode extends MapRewardNode {
    kind: "completion";
    showMultiplayerShare?: boolean;
}

interface MapCompletionAction {
    kind: "activity" | "map" | "docs" | "editor" | "tutorial";
    label?: string;
    activityId?: string;
    url?: string;
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

interface GraphCoord {
    depth: number; // The depth of this node (distance from root)
    offset: number; // The offset of the node within the layer
}

interface GraphNode extends BaseNode, GraphCoord {
    width?: number; // The maximum subtree width from this node
    parents?: GraphNode[];
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