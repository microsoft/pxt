export function isMapCompleted(user: UserState, pageSource: string, map: SkillMap, skipActivity?: string) {
    if (Object.keys(map?.activities).some(k => !lookupMapProgress(user, pageSource, map.mapId)?.activityState[k]?.isCompleted && k !== skipActivity)) return false;
    return true;
}

export function isActivityCompleted(user: UserState, pageSource: string, mapId: string, activityId: string) {
    return !!(lookupActivityProgress(user, pageSource, mapId, activityId)?.isCompleted);
}

export function isMapUnlocked(user: UserState, map: SkillMap, pageSource: string) {
    for (const pre of map.prerequisites) {
        if (pre.type === "tag") {
            if (!user.completedTags[pageSource]) return false;

            const numCompleted = user.completedTags[pageSource][pre.tag];
            if (numCompleted === undefined || numCompleted < pre.numberCompleted) return false;
        }
        else if (pre.type === "map") {
            if (!isMapCompleted(user, pageSource, map)) return false;
        }
    }

    return true;
}

export function getCompletedTags(user: UserState, pageSource: string, maps: SkillMap[]) {
    const completed: CompletedTags = {};

    for (const map of maps) {
        for (const activityId of Object.keys(map.activities)) {
            const activity = map.activities[activityId];
            if (isActivityCompleted(user, pageSource, map.mapId, activity.activityId)) {
                for (const tag of activity.tags) {
                    if (!completed[tag]) completed[tag] = 0;
                    completed[tag] ++;
                }
            }
        }
    }

    return completed;
}

export function isActivityUnlocked(user: UserState, pageSource: string, map: SkillMap, activityId: string) {
    if (map.root.activityId === activityId) return true;

    return checkRecursive(map.root);

    function checkRecursive(root: MapActivity) {
        if (isActivityCompleted(user, pageSource, map.mapId, root.activityId)) {
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

export function lookupMapProgress(user: UserState, pageSource: string, mapId: string): MapState | undefined {
    return user.mapProgress[pageSource] ? user.mapProgress[pageSource][mapId] : undefined;
}

export function lookupActivityProgress(user: UserState, pageSource: string, mapId: string, activityId: string) {
    return lookupMapProgress(user, pageSource, mapId)?.activityState[activityId]
}

export function applyUserUpgrades(user: UserState, currentVersion: string, pageSource: string, maps: { [key: string]: SkillMap }) {
    const oldVersion = pxt.semver.parse(user.version || "0.0.0");
    const newVersion = pxt.semver.parse(currentVersion);
    let upgradedUser = user;

    if (pxt.semver.cmp(oldVersion, newVersion) === 0) return upgradedUser;

    // version 0.0.0 -> version 0.0.1 upgrade
    // mapProgress was previously a map of learning path ID to map state
    // upgrading to key everything on pageSourceUrl
    if (pxt.semver.cmp(oldVersion, pxt.semver.parse("0.0.0")) === 0) {
        let oldMaps = user?.mapProgress && Object.keys(user?.mapProgress);
        // Double-check to see that we have the old format
        if (oldMaps?.length > 0 && !!user.mapProgress[oldMaps[0]].activityState) {
            const oldUser = user;
            const progress: { [key: string]: MapState } = {};
            const currentMaps = Object.keys(maps);
            currentMaps.forEach((m) => { if (oldUser.mapProgress[m]) progress[m] = oldUser.mapProgress[m] as any })
            upgradedUser = {
                ...oldUser,
                mapProgress: {
                    [pageSource]: progress
                }
            };
        }
    }

    return upgradedUser;
}