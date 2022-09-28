import { GameMode, GameStatus, GameInfo } from "../types"

// Changes to app state are performed by dispatching actions to the reducer
type ActionBase = {
    type: string
}

/**
 * Actions
 */

type SetUserProfileAction = ActionBase & {
    type: "SET_USER_PROFILE"
    profile?: pxt.auth.UserProfile
}

type SetGameMode = ActionBase & {
    type: "SET_GAME_MODE"
    gameMode: GameMode
}

type SetGameStatus = ActionBase & {
    type: "SET_GAME_STATUS"
    gameStatus: GameStatus
}

type SetGameId = ActionBase & {
    type: "SET_GAME_ID"
    gameId: string
}

type SetGameInfo = ActionBase & {
    type: "SET_GAME_INFO"
    gameInfo: GameInfo
}

type SetErrorMessage = ActionBase & {
    type: "SET_ERROR_MESSAGE"
    message: string | undefined
}

/**
 * Union of all actions
 */

export type Action = SetUserProfileAction | SetGameMode | SetGameStatus | SetGameId | SetGameInfo | SetErrorMessage

/**
 * Action creators
 */

export const setUserProfile = (profile?: pxt.auth.UserProfile): SetUserProfileAction => ({
    type: "SET_USER_PROFILE",
    profile
})

export const clearUserProfile = (): SetUserProfileAction => ({
    type: "SET_USER_PROFILE",
    profile: undefined
})

export const setGameMode = (gameMode: GameMode): SetGameMode => ({
    type: "SET_GAME_MODE",
    gameMode
})

export const setGameStatus = (gameStatus: GameStatus): SetGameStatus => ({
    type: "SET_GAME_STATUS",
    gameStatus
})

export const setGameId = (gameId: string): SetGameId => ({
    type: "SET_GAME_ID",
    gameId
})

export const setGameInfo = (gameInfo: GameInfo): SetGameInfo => ({
    type: "SET_GAME_INFO",
    gameInfo
})

export const setErrorMessage = (message: string): SetErrorMessage => ({
    type: "SET_ERROR_MESSAGE",
    message
})

export const clearErrorMessage = (): SetErrorMessage => ({
    type: "SET_ERROR_MESSAGE",
    message: undefined
})
