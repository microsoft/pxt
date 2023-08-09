import { GamepadManager } from "./GamepadManager";
import { HighScore } from "./HighScore";
import { GameData } from "./GameData";
import { BuiltSimJSInfo } from "./BuiltSimJsInfo";
import { KioskState } from "./KioskState";
import configData from "../config.json";
import { getGameDetailsAsync } from "../BackendRequests"
import { tickEvent } from "../browserUtils";
export class Kiosk {
    games: GameData[] = [];
    gamepadManager: GamepadManager = new GamepadManager();
    selectedGame?: GameData;
    selectedGameIndex?: number;
    mostRecentScores: number[] = [];
    onGameSelected!: () => void;
    onNavigated!: () => void;
    launchedGame: string = "";
    state: KioskState = KioskState.MainMenu;
    clean: boolean;
    locked: boolean;
    time?: string;

    private readonly highScoresLocalStorageKey: string = "HighScores";
    private readonly addedGamesLocalStorageKey: string = "UserAddedGames";
    private initializePromise: any;
    private siteElements: ChildNode[] = [];
    private intervalId: any;
    private readonly allScoresStateKey: string = "S/all-scores";
    private lockedGameId?: string;
    private builtGamesCache: { [gameId: string]: BuiltSimJSInfo } = { };
    private defaultGameDescription = "Made with love in MakeCode Arcade";

    constructor(clean: boolean, locked: boolean, time?: string) {
        this.clean = clean;
        this.locked = locked;
        this.time = time;
    }

    async downloadGameListAsync(): Promise<void> {
        if (!this.clean) {
            let url = configData.GameDataUrl;
    
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Unable to download game list from "${url}"`);
            }
    
            try {
                this.games = (await response.json()).games;
                this.games.push()
            }
            catch (error) {
                throw new Error(`Unable to process game list downloaded from "${url}": ${error}`);
            }
        } else {
            tickEvent("kiosk.clean");
        }

        // the added games persist in local storage, but not the live game list
        // that feeds the carousel. That's what this function is for.
        this.addNewGamesToList();
    }

    getGameName(name: string) {
        if (name.toLowerCase() === "untitled") {
            return "Kiosk Game";
        }
        
        return name;
    }

    getGameDescription(desc: string) {
        if (desc.length === 0) {
            return this.defaultGameDescription
        }
        
        return desc;
    }

    async saveNewGamesAsync(games: { [index: string]: { [index: string]: string } }): Promise<string[]> {
        const allAddedGames = this.getAllAddedGames();
        let gamesToAdd: string[] = [];
        const gameIds = Object.keys(games);
        for (const gameId of gameIds) {
            if (!allAddedGames[gameId]) {
                let gameName;
                let gameDescription;
    
                try {
                    const gameDetails = await getGameDetailsAsync(gameId);
                    gameName = this.getGameName(gameDetails.name);
                    gameDescription = this.getGameDescription(gameDetails.description);
                } catch (error) {
                    gameName = "Kiosk Game";
                    gameDescription = this.defaultGameDescription;
                }
    
                const gameUploadDate = (new Date()).toLocaleString()
                const newGame = new GameData(gameId, gameName, gameDescription, "None", games[gameId].id, gameUploadDate, true);
    
                this.games.push(newGame);
                gamesToAdd.push(gameName);
                allAddedGames[gameId] = newGame;
            } else if (allAddedGames[gameId]?.deleted) {
                if (games[gameId].id !== allAddedGames[gameId].uniqueIdentifier) {
                    allAddedGames[gameId].uniqueIdentifier = games[gameId].id;
                    allAddedGames[gameId].deleted = false;
                    gamesToAdd.push(allAddedGames[gameId].name);
                    this.games.push(allAddedGames[gameId]);
                }
            } else {
                // we need to keep the backend and frontend unique identifiers the same
                allAddedGames[gameId].uniqueIdentifier = games[gameId].id;
            }
        }
        if (gamesToAdd.length) {
            this.selectGame(0);
        }
        localStorage.setItem(this.addedGamesLocalStorageKey, JSON.stringify(allAddedGames));
        return gamesToAdd;
    }

    getAllAddedGames(): { [index: string]: GameData } {
        const json = localStorage.getItem(this.addedGamesLocalStorageKey);
        if (!json) {
            return {};
        }
        const allAddedGames: { [index: string]: GameData } = JSON.parse(json);
        return allAddedGames;
    }

    addNewGamesToList() : void {
        // check if there are custom games to add to the game list from local storage
        const addedGames = this.getAllAddedGames();
        const addedGamesObjs: GameData[] = Object.values(addedGames);
        for (const game of addedGamesObjs) {
            if (!game?.deleted) {
                this.games.push(game);
            }
        }
    }

    gamePadLoop(): void {
        const isDebug = true;
        if (isDebug) {
            // Add cases for debugging via the gamepad here.
        }

        if (this.gamepadManager.isResetButtonPressed() &&
            this.gamepadManager.isEscapeButtonPressed() &&
            this.gamepadManager.isBButtonPressed() &&
            this.gamepadManager.isLeftPressed()) {
                this.resetHighScores();
                console.log("High scores reset");
                return;
        }

        if (this.gamepadManager.isEscapeButtonPressed() || this.gamepadManager.isMenuButtonPressed()) {
            if (this.state === KioskState.PlayingGame) {
                this.escapeGame();
            } else {
                this.showMainMenu();
            }
            return;
        }
    }

    async initialize(): Promise<void> {
        if (this.initializePromise) {
            return this.initializePromise;
        }

        this.initializePromise = this.downloadGameListAsync();

        this.intervalId = setInterval(() => this.gamePadLoop(), configData.GamepadPollLoopMilli);

        window.addEventListener("message", (event) => {
            if (event.data?.js) {
                let builtGame: BuiltSimJSInfo | undefined = this.getBuiltGame(this.launchedGame);
                if (!builtGame) {
                    this.addBuiltGame(this.launchedGame, event.data);
                } else {
                    this.sendBuiltGame(this.launchedGame);
                }
            }
            switch (event.data.type) {
                case "simulator":
                    switch (event.data.command) {
                        case "setstate":
                            switch (event.data.stateKey) {
                                case this.allScoresStateKey:
                                    const rawData = atob(event.data.stateValue);
                                    const json = decodeURIComponent(rawData);
                                    this.mostRecentScores = JSON.parse(json);
                                    this.gameOver();
                                    break;
                            }
                            break;
                    }
                    break;
                case "messagepacket":
                    const channel = event.data.channel;
                    const parts = channel.split("-");
                    if (parts[0] === "keydown") {
                        this.gamepadManager.keyboardManager.onKeydown(parts[1]);
                    }
                    else {
                        this.gamepadManager.keyboardManager.onKeyup(parts[1]);
                    }
                    break;

                case "ready":
                    let builtGame: BuiltSimJSInfo | undefined = this.getBuiltGame(this.launchedGame);
                    if (builtGame) {
                        this.sendBuiltGame(this.launchedGame);
                    }
                    break;
            }
        });

        return this.initializePromise;
    }

    cleanup() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }

    navigate(state: KioskState) {
        this.state = state;
        if (this.onNavigated) {
            this.onNavigated();
        }
    }

    showMainMenu() {
        this.navigate(KioskState.MainMenu);
    }

    selectGame(gameIndex: number): void {
        if (gameIndex >= 0) {
            this.selectedGame = this.games[gameIndex];
            this.selectedGameIndex = gameIndex;
        }
        else {
            this.selectedGame = undefined;
        }
    }

    exitToEnterHighScore(): void {
        const launchedGameHighs = this.getHighScores(this.launchedGame);
        const currentHighScore = this.mostRecentScores[0];
        const lastScore = launchedGameHighs[launchedGameHighs.length - 1]?.score;
        if (launchedGameHighs.length === configData.HighScoresToKeep 
            && lastScore 
            && currentHighScore < lastScore) {
                this.exitGame(KioskState.GameOver);

        } else {
            this.exitGame(KioskState.EnterHighScore);
        }

    }

    gameOver(skipHighScore?: boolean): void {
        if (this.state !== KioskState.PlayingGame) { return; }

        if (this.lockedGameId) {
            this.launchGame(this.lockedGameId);
            return;
        }

        if (!skipHighScore && this.mostRecentScores && this.mostRecentScores.length && (this.selectedGame!.highScoreMode !== "None")) {
            this.exitToEnterHighScore();
        }
        else {
            this.exitGame(KioskState.GameOver);
        }
    }

    escapeGame(): void {
        if (this.state !== KioskState.PlayingGame || this.lockedGameId) { return; }
        this.gamepadManager.keyboardManager.clear();
        this.exitGame(KioskState.MainMenu);
    }

    private exitGame(state: KioskState): void {
        if (this.state !== KioskState.PlayingGame) { return; }
        this.navigate(state);

        const gamespace = document.getElementsByTagName("BODY")[0];
        while (gamespace.firstChild) {
            gamespace.firstChild.remove();
        }

        this.siteElements.forEach(item => gamespace.appendChild(item));
    }

    getBuiltGame(gameId: string): BuiltSimJSInfo | undefined {
        const allBuiltGames = this.builtGamesCache;
        if (allBuiltGames[gameId]) {
            return allBuiltGames[gameId];
        }
    }

    addBuiltGame(gameId: string, builtSimJs: BuiltSimJSInfo) {
        const allBuiltGames = this.builtGamesCache;

        if (!allBuiltGames[gameId]) {
            allBuiltGames[gameId] = builtSimJs;
        }

    }

    sendBuiltGame(gameId: string) {
        const builtGame = this.getBuiltGame(gameId);
        const simIframe = document.getElementsByTagName("iframe")[0] as HTMLIFrameElement;
        simIframe?.contentWindow?.postMessage({ ...builtGame, "type": "builtjs"}, "*");
    }

    launchGame(gameId: string, preventReturningToMenu = false): void {
        this.launchedGame = gameId;
        if (this.state === KioskState.PlayingGame) { return; }
        if (preventReturningToMenu) this.lockedGameId = gameId;
        this.navigate(KioskState.PlayingGame);

        this.siteElements = [];
        const gamespace = document.getElementsByTagName("BODY")[0];
        while (gamespace.firstChild) {
            this.siteElements.push(gamespace.firstChild);
            gamespace.firstChild.remove();
        }

        const playUrlBase = `${configData.PlayUrlRoot}?id=${gameId}&hideSimButtons=1&noFooter=1&single=1&fullscreen=1&autofocus=1`
        let playQueryParam = this.getBuiltGame(gameId) ? "&server=1" : "&sendBuilt=1";

        function createIFrame(src: string) {
            const iframe: HTMLIFrameElement = document.createElement("iframe");
            iframe.className = "sim-embed";
            iframe.frameBorder = "0";
            iframe.setAttribute("sandbox", "allow-popups allow-forms allow-scripts allow-same-origin");
            iframe.src = src;
            return iframe;
        }
        const playerIFrame = createIFrame(playUrlBase + playQueryParam);
        gamespace.appendChild(playerIFrame);
        playerIFrame.focus();
    }

    launchAddGame() {
        this.navigate(KioskState.AddingGame);
    }

    getAllHighScores(): { [index: string]: HighScore[] } {
        const json = localStorage.getItem(this.highScoresLocalStorageKey);
        if (!json) {
            return {};
        }

        const allHighScores: {[index: string]: HighScore[]} = JSON.parse(json);
        return allHighScores;
    }

    getHighScores(gameId: string): HighScore[] {
        const allHighScores = this.getAllHighScores();
        if (!allHighScores[gameId]) {
            return [];
        }

        return allHighScores[gameId];
    }

    saveHighScore(gameId: string, initials: string, score: number) {
        const allHighScores = this.getAllHighScores();
        if (!allHighScores[gameId]) {
            allHighScores[gameId] = [];
        }

        allHighScores[gameId].push(new HighScore(initials, score));

        allHighScores[gameId].sort((first, second) => second.score - first.score);
        allHighScores[gameId].splice(configData.HighScoresToKeep);

        localStorage.setItem(this.highScoresLocalStorageKey, JSON.stringify(allHighScores));
    }

    resetHighScores() {
        localStorage.removeItem(this.highScoresLocalStorageKey);
    }
}