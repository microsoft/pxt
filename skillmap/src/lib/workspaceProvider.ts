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

export async function getLocalUserStateAsync(): Promise<UserState> {
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

    return userState;
}

export async function getUserStateAsync(): Promise<UserState> {
    // User state is stored in two places, so we read both sources here and merge them.
    // Though the entire user state is saved to the local workspace, the authClient
    // module is the authoritative source for the completedTags and mapProgress fields
    // when auth is enabled.
    let userState = await getLocalUserStateAsync();

    if (await authClient.loggedInAsync()) {
        // Read synchronized skillmap state from cloud profile. Fallback to workspace-saved state.
        const skillmapState = await authClient.getSkillmapStateAsync();
        userState = {
            ...userState,
            mapProgress: skillmapState?.mapProgress || {},
            completedTags: skillmapState?.completedTags || {}
        };
    }

    return userState;
}

export async function saveUserStateAsync(user: UserState): Promise<void> {
    // Don't save debug user state
    if (user.isDebug) return;

    const ws = await getWorkspaceAsync();
    if (!(await pxt.auth.client()?.loggedInAsync())) {
        await ws.saveUserStateAsync(user);
    }

    // Sync skillmap progress to cloud. This state will always be stored locally, and synced
    // to the cloud if the user is signed in. authClient is the authoritative source for the
    // mapProgress and completedTags fields when auth is enabled.
    await authClient.saveSkillmapStateAsync({
        mapProgress: user.mapProgress,
        completedTags: user.completedTags
    });
}
