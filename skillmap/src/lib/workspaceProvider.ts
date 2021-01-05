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

export async function getUserStateAsync(): Promise<UserState | undefined> {
    const ws = await getWorkspaceAsync();

    return ws.getUserStateAsync();
}

export async function saveUserStateAsync(user: UserState): Promise<void> {
    // Don't save debug user state
    if (user.isDebug) return;

    const ws = await getWorkspaceAsync();
    await ws.saveUserStateAsync(user);
}
