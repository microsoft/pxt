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

    activities: {[index: string]: MapActivity};
    root: MapActivity;
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

type MapActivityType = "tutorial";

interface MapActivity {
    activityId: string;

    displayName: string;
    description?: string;
    tags: string[];

    type: MapActivityType;
    editor: "blocks" | "js" | "py";

    url: string;
    imageUrl?: string;

    next: MapActivity[];
    nextIds: string[];
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