import * as authClient from './authClient';
import { guidGen } from './browserUtils';

let workspace: pxt.skillmap.WorkspaceProvider<UserState>;
let workspacePromise: Promise<pxt.skillmap.WorkspaceProvider<UserState>>;

function getWorkspaceAsync() {
    if (!workspacePromise) {
        workspace = new pxt.skillmap.IndexedDBWorkspace<UserState>();
        workspacePromise = workspace.initAsync()
            .then(wp => workspace);
    }
    return workspacePromise;
}

export async function getProjectAsync(headerId: string): Promise<pxt.workspace.Project> {
    const ws = await getWorkspaceAsync();
    return ws.getProjectAsync(headerId);
}

export async function saveProjectAsync(project: pxt.workspace.Project): Promise<void> {
    const ws = await getWorkspaceAsync();
    await ws.saveProjectAsync(project);
}

export async function getUserStateAsync(): Promise<UserState> {
    const ws = await getWorkspaceAsync();

    let userState = await ws.getUserStateAsync();
    if (!userState) {
        userState = {
            id: guidGen(),
            completedTags: {},
            mapProgress: {},
            version: pxt.skillmap.USER_VERSION
        };
    }
    // Read synchronized skillmap state from cloud profile.
    const skillmapState = await authClient.getSkillmapStateAsync();
    userState = {
        ...userState,
        mapProgress: skillmapState?.mapProgress ?? {},
        completedTags: skillmapState?.completedTags ?? {}
    };
    return userState;
}

export async function saveUserStateAsync(user: UserState): Promise<void> {
    // Don't save debug user state
    if (user.isDebug) return;

    const ws = await getWorkspaceAsync();
    await ws.saveUserStateAsync(user);

    // Sync skillmap progress to cloud
    await authClient.saveSkillmapStateAsync({
        mapProgress: user.mapProgress,
        completedTags: user.completedTags
    });
}
