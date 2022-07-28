declare namespace gameplay {
    /**
     * Change the game mode for the selected players
     * @param mode the desired game mode
     * @param player a selector to determine which players to change the game mode for
     */
    //% help=gameplay/set-game-mode
    //% promise
    //% weight=210 blockGap=60
    //% blockId=minecraftGamemode block="change game mode to %mode|for %player=minecraftTarget"
    //% blockExternalInputs=1
    //% mode.defl=SURVIVAL
    //% shim=gameplay::setGameModeAsync promise
    function setGameMode(mode: GameMode, player: TargetSelector): void;
}

//% emitAsConstant
declare const enum GameMode {
    //% block=survival alias=SURVIVAL
    Survival,
    //% block=creative alias=CREATIVE
    Creative,
    //% block=adventure alias=ADVENTURE
    Adventure
}

/**
 * A target selector
 */
//% snippet=mobs.target(NEAREST_PLAYER)
//% pySnippet=mobs.target(NEAREST_PLAYER)
declare class TargetSelector {
}

//% enumIdentity="GameMode.Survival"
const SURVIVAL = GameMode.Survival;
//% enumIdentity="GameMode.Creative"
const CREATIVE = GameMode.Creative;
//% enumIdentity="GameMode.Adventure"
const ADVENTURE = GameMode.Adventure;