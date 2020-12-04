
export function isMapCompleted(user: UserState, map: SkillMap, skipActivity?: string) {
    if (Object.keys(map?.activities).some(k => !user?.mapProgress[map.mapId]?.activityState[k]?.isCompleted && k !== skipActivity)) return false;
    return true;
}

export function isActivityCompleted(user: UserState, mapId: string, activityId: string) {
    return !!(lookupActivityProgress(user, mapId, activityId)?.isCompleted);
}

export function isMapUnlocked(user: UserState, map: SkillMap, pageSource: string) {
    for (const pre of map.prerequisites) {
        if (pre.type === "tag") {
            if (!user.completedTags[pageSource]) return false;

            const numCompleted = user.completedTags[pageSource][pre.tag];
            if (numCompleted === undefined || numCompleted < pre.numberCompleted) return false;
        }
        else if (pre.type === "map") {
            if (!isMapCompleted(user, map)) return false;
        }
    }

    return true;
}

export function getCompletedTags(user: UserState, maps: SkillMap[]) {
    const completed: CompletedTags = {};

    for (const map of maps) {
        for (const activityId of Object.keys(map.activities)) {
            const activity = map.activities[activityId];
            if (isActivityCompleted(user, map.mapId, activity.activityId)) {
                for (const tag of activity.tags) {
                    if (!completed[tag]) completed[tag] = 0;
                    completed[tag] ++;
                }
            }
        }
    }

    return completed;
}

export function isActivityUnlocked(user: UserState, map: SkillMap, activityId: string) {
    if (map.root.activityId === activityId) return true;

    return checkRecursive(map.root);

    function checkRecursive(root: MapActivity) {
        if (isActivityCompleted(user, map.mapId, root.activityId)) {
            if (root.next.some(activity => activity.activityId === activityId)) {
                return true;
            }

            for (const next of root.next) {
                if (checkRecursive(next)) return true;
            }
        }

        return false;
    }
}

export function lookupActivityProgress(user: UserState, mapId: string, activityId: string) {
    return user.mapProgress[mapId]?.activityState[activityId]
}
