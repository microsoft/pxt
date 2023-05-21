/*
 * "Epics" are functions that modify the state of the app in complex ways over a period of time.
 */

export { hostGameAsync } from "./hostGameAsync";
export { joinGameAsync } from "./joinGameAsync";
export { startGameAsync } from "./startGameAsync";
export { leaveGameAsync } from "./leaveGameAsync";
export { setGameModeAsync } from "./setGameModeAsync";
export { signInAsync } from "./signInAsync";
export { signOutAsync } from "./signOutAsync";
export { notifyGameDisconnected } from "./notifyGameDisconnected";
export { setPresenceAsync } from "./setPresenceAsync";
export { sendReactionAsync } from "./sendReactionAsync";
export { setReactionAsync } from "./setReactionAsync";
export { playerJoinedAsync } from "./playerJoinedAsync";
export { playerLeftAsync } from "./playerLeftAsync";
export { userSignedInAsync } from "./userSignedInAsync";
export { setUserProfileAsync } from "./setUserProfileAsync";
export { setGameMetadataAsync } from "./setGameMetadataAsync";
export { kickPlayer } from "./kickPlayer";
export { gameOverAsync } from "./gameOverAsync";
export { pauseGameAsync } from "./pauseGameAsync";
export { resumeGameAsync } from "./resumeGameAsync";
export { visibilityChanged } from "./visibilityChanged";
export { sendAbuseReportAsync } from "./sendAbuseReportAsync";
export { setCustomIconAsync } from "./setCustomIconAsync";
