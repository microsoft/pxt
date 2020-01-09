//% color=#0078D7 weight=100
namespace userEnums {
    /**
     * Test enum define block
     */
    //% shim=ENUM_GET
    //% blockId=enum_user_shim block="%arg"
    //% enumName="PlainOldEnum" enumMemberName="whatever" enumPromptHint="whatever" enumInitialMembers="whatever"
    export function userEnumShim(arg: number) {
        return arg;
    }

    /**
     * Test enum define block with a start value set
     */
    //% shim=ENUM_GET
    //% blockId=enum_user_shim_with_start_value block="%arg"
    //% enumName="EnumWithStart" enumMemberName="whatever" enumPromptHint="whatever" enumInitialMembers="whatever"
    //% enumStartValue=3
    export function userEnumShimStartValue(arg: number) {
        return arg;
    }

    /**
     * Test enum define block for a bit mask
     */
    //% shim=ENUM_GET
    //% blockId=enum_user_shim_bit_mask block="%arg"
    //% enumName="EnumOfFlags" enumMemberName="whatever" enumPromptHint="whatever"  enumInitialMembers="whatever"
    //% enumIsBitMask=true
    export function userEnumShimBitMask(arg: number) {
        return arg;
    }

    /**
     * Test enum define block for a hash
     */
    //% shim=ENUM_GET
    //% blockId=enum_user_shim_hash block="%arg"
    //% enumName="EnumHash" enumMemberName="whatever" enumPromptHint="whatever"  enumInitialMembers="whatever,dontcare"
    //% enumIsHash=true
    export function userEnumShimHash(arg: number) {
        return arg;
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