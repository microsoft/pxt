/**
 * Test constants like Math.PI
 */
//% color=#5C2D91 weight=31
//% advanced=true
namespace constant {
    //% blockIdentity=constant._constant
    export const PI = 3.14;
    //% blockIdentity=constant._constant
    export const LN2 = 0;

    /**
     * Constants defined on the namespace
     */
    //% blockId=constant_dropdown block="%constant" constantShim
    //% shim=TD_ID weight=20 blockGap=8
    export function _constant(constant: number): number {
        return constant;
    }
}


//% emitAsConstant
declare const enum Item {
    //% blockIdentity="blocks.item" enumval=256 block="Iron Shovel"
    //% jres
    IronShovel = 256,
    //% blockIdentity="blocks.item" enumval=257 block="Iron Pickaxe"
    //% jres
    IronPickaxe = 257
}

//% blockIdentity="blocks.item" enumIdentity="Item.IronShovel"
const IRON_SHOVEL = Item.IronShovel;
//% blockIdentity="blocks.item" enumIdentity="Item.IronPickaxe"
const IRON_PICKAXE = Item.IronPickaxe;

//% emitAsConstant
declare const enum SixDirection {
    //% block=forward
    Forward,
    //% block=back
    Back
}

//% enumIdentity="SixDirection.Forward"
const FORWARD = SixDirection.Forward;
//% enumIdentity="SixDirection.Back"
const BACK = SixDirection.Back;

declare namespace agent {
    /**
     * Commands the agent to destroy a block in the given direction
     * @param direction the direction in which the agent will destroy a block, eg: SixDirection.Forward
     */
    //% help=agent/destroy
    //% promise
    //% group="Actions" weight=260
    //% blockId=minecraftAgentCommandDestroy block="agent destroy|%direction"
    //% shim=agent::destroyAsync promise
    function destroy(direction: SixDirection): void;


    /**
     * Commands the agent to Collect a block or item of the specified type
     * @param block the type of the block or item to collect
     */
    //% help=agent/collect
    //% promise
    //% group="Actions" weight=220
    //% blockId=minecraftAgentCollect block="agent collect %block=minecraftItem"
    //% block.shadow=minecraftItem
    //% shim=agent::collectAsync promise
    function collect(block: number): void;
}

declare namespace blocks {
    /**
     * Represents an item from the game
     * @param item the item
     */
    //% help=blocks/item
    //% weight=320
    //% shim=TD_ID blockId=minecraftItem block="item %item"
    //% item.fieldEditor="gridpicker"
    //% item.fieldOptions.width=340 item.fieldOptions.columns=8 item.fieldOptions.tooltips=true
    //% item.fieldOptions.tooltipsXOffset="20" item.fieldOptions.tooltipsYOffset="-20"
    //% item.fieldOptions.maxRows="8"
    //% item.fieldOptions.hasSearchBar=true
    //% item.fieldOptions.hideRect=true
    function item(item: Item): number;
}