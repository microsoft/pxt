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
    //% block=creative alias=CREATIVE tags=builder
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

enum PickerChoice {
    //% blockHidden=1 tags=eligible
    Hidden,
    //% tags=ineligible
    Other,
    //% tags=eligible
    Allowed
}

class PickerSnippetAsset {
    value: number;
}

namespace pickerAssets {
    //% fixedInstance tags=ineligible weight=1000
    export const other = new PickerSnippetAsset();
    //% fixedInstance tags=eligible weight=10
    export const earlier = new PickerSnippetAsset();
    //% fixedInstance tags=eligible weight=90
    export const allowed = new PickerSnippetAsset();
    //% fixedInstance tags=ineligible
    export const camelAsset = new PickerSnippetAsset();
}

//% fixedInstances
class PickerSnippetReceiver {
    //% blockId=snippet_receiver_action block="use %device"
    //% this.fieldEditor=gridpicker
    //% this.fieldOptions.filter=eligible
    action(): void {}
}

namespace pickerReceivers {
    //% fixedInstance tags=ineligible
    export const alpha = new PickerSnippetReceiver();
    //% fixedInstance tags=eligible
    export const betaDevice = new PickerSnippetReceiver();
}

//% fixedInstances
class PickerDefaultReceiver {
    //% blockId=snippet_default_receiver_action block="use %device"
    //% this.fieldEditor=gridpicker
    //% this.defl=pickerDefaultReceivers.betaDevice
    action(): void {}
}

namespace pickerDefaultReceivers {
    //% fixedInstance
    export const alpha = new PickerDefaultReceiver();
    //% fixedInstance
    export const betaDevice = new PickerDefaultReceiver();
}

declare namespace pickerSnippets {
    //% blockId=snippet_choose_mode block="choose %choice"
    //% value.fieldEditor=gridpicker
    //% choice.fieldOptions.enumNames="GameMode"
    //% choice.fieldOptions.filter=builder
    function chooseMode(value: number): void;

    //% blockId=snippet_choose_choice block="choose %choice"
    //% value.fieldEditor=gridpicker
    //% choice.fieldOptions.enumNames="PickerChoice,GameMode"
    //% choice.fieldOptions.filter=eligible
    function chooseChoice(value: number): void;

    //% blockId=snippet_choose_explicit block="choose %choice"
    //% value.fieldEditor=gridpicker value.defl=PickerChoice.Other
    //% choice.fieldOptions.enumNames="PickerChoice"
    //% choice.fieldOptions.filter=eligible
    function chooseExplicit(value: number): void;

    //% blockId=snippet_choose_asset block="choose %choice"
    //% value.fieldEditor=gridpicker
    //% choice.fieldOptions.fixedInstances=true
    //% choice.fieldOptions.filter=eligible
    function chooseAsset(value: PickerSnippetAsset): void;

    //% blockId=snippet_choose_explicit_asset block="choose %choice"
    //% value.fieldEditor=gridpicker value.defl=pickerAssets.camelAsset
    //% choice.fieldOptions.fixedInstances=true
    //% choice.fieldOptions.filter=eligible
    function chooseExplicitAsset(value: PickerSnippetAsset): void;

    //% blockId=snippet_choose_unmatched block="choose %choice"
    //% value.fieldEditor=gridpicker
    //% choice.fieldOptions.enumNames="PickerChoice"
    //% choice.fieldOptions.filter=missing
    function chooseUnmatched(value: number): void;
}