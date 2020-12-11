import * as cloud from "../cloud";

type WorkspaceProvider = pxt.workspace.WorkspaceProvider;

export const provider: WorkspaceProvider = {
    getAsync: cloud.getAsync,
    setAsync: cloud.setAsync,
    deleteAsync: cloud.deleteAsync,
    listAsync: cloud.listAsync,
    resetAsync: cloud.resetAsync,
}

// TODO @darzu: throttled workspace ??

// TODO @darzu: do we need a subscription here?
// export function init() {
//     data.subscribe(userSubscriber, auth.LOGGED_IN);
// }

// let prevWorkspaceType: string;

// async function updateWorkspace() {
//     const loggedIn = await auth.loggedIn();
//     if (loggedIn) {
//         // TODO: Handling of 'prev' is pretty hacky. Need to improve it.
//         let prev = workspace.switchToCloudWorkspace();
//         if (prev !== "cloud") {
//             prevWorkspaceType = prev;
//         }
//         await workspace.syncAsync();
//     } else if (prevWorkspaceType) {
//         workspace.switchToWorkspace(prevWorkspaceType);
//         await workspace.syncAsync();
//     }
// }

// const userSubscriber: data.DataSubscriber = {
//     subscriptions: [],
//     onDataChanged: async () => updateWorkspace()
// };