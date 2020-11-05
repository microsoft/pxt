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

    activities: {[index: string]: MapActivity};
    root: MapActivity;
}

type MapPrerequisite = TagPrerequisite | ActivityPrerequisite;

interface TagPrerequisite {
    type: "tag"
    tag: string;
    numberCompleted: number;
}

interface ActivityPrerequisite {
    type: "activity";
    mapId: string;
}

interface MapActivity {
    activityId: string;

    displayName: string;
    description?: string;
    tags: string[];

    type: "tutorial";
    editor: "blocks" | "js" | "py";

    url: string;
    imageUrl?: string;

    next: MapActivity[];
    nextIds: string[];
}

interface UserState {
    mapProgress: {[index: string]: MapState};
    completedTags: {[index: string]: number};
}

interface MapState {
    mapId: string;
    activityState: {[index: string]: ActivityState};
}

interface ActivityState {
    activityId: string;
    headerId: string;
    isCompleted: boolean;
}