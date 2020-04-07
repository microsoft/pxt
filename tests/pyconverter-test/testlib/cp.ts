
declare const enum Block {
    //% blockIdentity="blocks.block" enumval=2 block="Grass Block"
    //% jres
    Grass = 2,
    //% blockIdentity="blocks.block" enumval=0 block="Air"
    //% jres
    Air = 0
}

declare const enum Item {
    //% blockIdentity="blocks.item" enumval=256 block="Iron Shovel"
    //% jres
    IronShovel = 256,
    //% blockIdentity="blocks.item" enumval=257 block="Iron Pickaxe"
    //% jres
    IronPickaxe = 257,
}

declare const enum TravelMethod {
    /**
     * Walking normally (default if on ground)
     */
    //% block=walk enumval=1
    Walk = 1,
    /**
     * Swimming in water
     */
    //% block="swim water" enumval=2
    SwimWater = 2,
}

declare const enum TestForBlocksMask {
    /**
     * Every block in the source and destination regions must match exactly.
     */
    //% block=all
    All,
    /**
     * Air blocks in the source region will match any block in the destination region.
     */
    //% block=masked
    Masked
}

declare const enum CloneMask {
    //% block=replace
    Replace,
    //% block=masked
    Masked
}

declare const enum CloneMode {
    //% block=normal
    Normal,
    //% block=move
    Move
}

declare const enum TargetSelectorKind {
    //% block="nearest player (@p)"
    NearestPlayer,
    //% block="yourself (@s)"
    LocalPlayer
}

declare const enum Axis {
    //% block="x (East/West)"
    X,
    //% block="y (Up/Down)"
    Y,
    //% block="z (South/North)"
    Z
}

declare const enum SixDirection {
    //% block=forward
    Forward,
    //% block=back
    Back,
    //% block=left
    Left,
    //% block=right
    Right,
    //% block=up
    Up,
    //% block=down
    Down
}

declare const enum FourDirection {
    //% block=forward
    Forward,
    //% block=back
    Back,
    //% block=left
    Left,
    //% block=right
    Right
}

declare const enum TurnDirection {
    //% block=left
    Left,
    //% block=right
    Right
}

declare const enum CardinalDirection {
    //% block="North (negative Z)"
    North,
    //% block="East (positive X)"
    East,
    //% block="South (positive Z)"
    South,
    //% block="up (positive Y)"
    Up,
    //% block="West (negative X)"
    West,
    //% block="down (negative Y)"
    Down
}

declare const enum CompassDirection {
    //% block="West (negative X)"
    West = CardinalDirection.West,
    //% block="East (positive X)"
    East = CardinalDirection.East,
    //% block="North (negative Z)"
    North = CardinalDirection.North,
    //% block="South (positive Z)"
    South = CardinalDirection.South
}

declare const enum AnimalMob {
    //% block="chicken" enumval=10
    //% jres
    Chicken,
    //% block="cow" enumval=11
    //% jres
    Cow,
}

declare const enum MonsterMob {
    //% block="zombie" enumval=32
    //% jres
    Zombie,
    //% block="creeper" enumval=33
    //% jres
    Creeper,
}

declare const enum ProjectileMob {
    //% block="primed tnt" enumval=65
    PrimedTnt,
    //% block="xp bottle" enumval=68
    XpBottle,
}

declare const enum Effect {
    //% block="Speed" enumval=1
    //% jres
    Speed = 1,
    //% block="Slowness" enumval=2
    //% jres
    Slowness = 2,
}

declare const enum AgentCommand {
    //% block=attack
    Attack,
    //% block=destroy
    Destroy
}

declare const enum AgentDetection {
    //% block="block"
    Block,
    //% block="redstone"
    Redstone
}

declare const enum AgentInspection {
    //% block="block"
    Block,
    //% block="data"
    Data
}

declare const enum BlockColor {
    //% block="white" enumval=14540253 blockIdentity=blocks.color
    White,
    //% block="orange" enumval=14384446 blockIdentity=blocks.color
    Orange
}

declare const enum GameMode {
    //% block=survival
    Survival,
    //% block=creative
    Creative
}

declare const enum Weather {
    //% block=clear
    Clear,
    //% block=rain
    Rain
}

declare const enum DayTime {
    //% block=day enumval=1000
    Day,
    //% block=dawn enumval=0
    Dawn
}

declare const enum FillOperation {
    //% block=replace
    Replace,
    //% block=hollow
    Hollow,
}

declare const enum GameRule {
    //% block=PvP
    PvP,
    //% block="drowning damage"
    DrowningDamage,
}

declare const enum GameDifficulty {
    //% block="peaceful"
    Peaceful,
    //% block="easy"
    Easy,
}

declare const enum AgentAssist {
    //% block="place on move"
    PlaceOnMove,
    //% block="place from any slot"
    PlaceFromAnySlot,
}

declare const enum TimeQuery {
    //% block=gametime
    GameTime,
    //% block=daytime
    DayTime,
}

declare const enum LeverPosition {
    //% block="on block bottom pointing West"
    BlockBottomEastWhenOff,
    //% block="on block East side"
    BlockSideFacingEast,
}

declare const enum ComparatorMode {
    //% block="compare"
    Compare,
    //% block="substract"
    Substract
}

declare const enum ShapeOperation {
    //% block=replace
    Replace,
    //% block=hollow
    Hollow
}

declare const enum ChatArgument {
    number,
    number2,
    string,
    string2,
    position,
    position2,
    selector,
    selector2
}

declare const enum ColoredBlock {
    //% blockIdentity="blocks.block" enumval=35 block="wool"
    //% jres
    Wool = 35,
    //% blockIdentity="blocks.block" enumval=236 block="concrete"
    Concrete = 236
}

// Auto-generated from simulator. Do not edit.
declare namespace agent {
    /**
     * Requests the agent to move in the specified direction
     * @param direction the direction in which the agent will move, eg: SixDirection.Forward
     * @param blocks how far the agent should move, in blocks, eg: 1
     */
    //% help=agent/move
    //% promise
    //% weight=370
    //% blockId=minecraftAgentMove block="agent move %direction|by %blocks"
    //% topblock topblockWeight=63
    //% shim=agent::moveAsync promise
    function move(direction: SixDirection, blocks: number): void;

    /**
     * Turns the agent in the specified direction
     * @param direction the turn direction, eg: TurnDirection.Left
     */
    //% help=agent/turn
    //% promise
    //% weight=360
    //% blockId=minecraftAgentTurn block="agent turn %direction"
    //% topblock topblockWeight=60
    //% shim=agent::turnAsync promise
    function turn(direction: TurnDirection): void;

    /**
     * Returns the agent's position in world coordinates
     */
    //% help=agent/get-position
    //% promise
    //% weight=350
    //% blockId=minecraftAgentGetPosition block="agent position"
    //% shim=agent::getPositionAsync promise
    function getPosition(): Position;

    /**
     * Returns the agent's orientation, in degrees
     */
    //% help=agent/get-orientation
    //% promise
    //% weight=340
    //% blockId=minecraftAgentGetOrientation block="agent orientation"
    //% shim=agent::getOrientationAsync promise
    function getOrientation(): number;

    /**
     * Places an item or block in the world from the agent's currently selected inventory slot
     * @param direction the direction in which to place the item, eg: SixDirection.Back
     */
    //% help=agent/place
    //% promise
    //% group="Actions" weight=270
    //% blockId=minecraftAgentPlace block="agent place %direction"
    //% topblock topblockWeight=55
    //% shim=agent::placeAsync promise
    function place(direction: SixDirection): void;

    /**
     * Detects if there is a block next to the agent in the specified direction
     * @param kind what the agent should attempt to detect
     * @param direction the direction in which to perform the detection, eg: SixDirection.Forward
     */
    //% help=agent/detect
    //% promise
    //% weight=320
    //% blockId=minecraftAgentDetect block="agent detect %kind|%direction"
    //% shim=agent::detectAsync promise
    function detect(kind: AgentDetection, direction: SixDirection): boolean;

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
     * Commands the agent to till soil in the given direction
     * @param direction the direction in which to till the soil, eg: SixDirection.Forward
     */
    //% help=agent/till
    //% promise
    //% group="Actions" weight=250
    //% blockId=minecraftAgentCommandTill block="agent till|%direction"
    //% shim=agent::tillAsync promise
    function till(direction: SixDirection): void;

    /**
     * Commands the agent to attack in the given direction
     * @param direction the direction in which to attack, eg: SixDirection.Forward
     */
    //% help=agent/attack
    //% promise
    //% group="Actions" weight=240
    //% blockId=minecraftAgentCommandAttack block="agent attack|%direction"
    //% shim=agent::attackAsync promise
    function attack(direction: SixDirection): void;

    /**
     * Commands the agent to drop its entire inventory in the given direction
     * @param direction the direction in which to drop items, eg: SixDirection.Forward
     */
    //% help=agent/drop-all
    //% promise
    //% group="Inventory" weight=160
    //% blockId=minecraftAgentCommandDropAll block="agent drop all|%direction"
    //% shim=agent::dropAllAsync promise
    function dropAll(direction: SixDirection): void;

    /**
     * Sets the agent's active inventory slot
     * @param slot the slot index between 1 and 27, eg: 1
     */
    //% help=agent/set-slot
    //% group="Inventory" weight=170
    //% blockId=minecraftAgentSetSlot block="agent set active slot %slot"
    //% slot.min=1 slot.max=27
    //% shim=agent::setSlot
    function setSlot(slot: number): void;

    /**
     * Puts the specified block or item in the agent's inventory
     * @param blockOrItem the block or item to give
     * @param count the amount to give, eg: 1
     * @param slot the slot index between 1 and 27, eg: 1
     */
    //% help=agent/set-item
    //% promise
    //% group="Inventory" weight=165
    //% blockId=minecraftAgentSetItem block="agent set block or item $blockOrItem|count $count|in slot $slot"
    //% blockOrItem.shadow=minecraftBlockField
    //% slot.min=1 slot.max=27
    //% count.min=1 count.max=64
    //% shim=agent::setItemAsync promise
    function setItem(blockOrItem: number, count: number, slot: number): void;

    /**
     * Controls which assists are enabled for the agent
     * @param assist the super power of the agent!
     * @param on whether the assist is enabled or not
     */
    //% help=agent/set-assist
    //% weight=310 blockGap=30
    //% blockId=minecraftAgentChangeAssist block="agent %assist|%on"
    //% shim=agent::setAssist
    function setAssist(assist: AgentAssist, on: boolean): void;

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

    /**
     * Commands the agent to collect all nearby blocks and items
     */
    //% help=agent/collect-all
    //% promise
    //% group="Actions" weight=230
    //% blockId=minecraftAgentCollectAll block="agent collect all"
    //% shim=agent::collectAllAsync promise
    function collectAll(): void;

    /**
     * Inspects a block in the specified direction and returns the block ID or data
     * @param kind the desired result type for the detection: block id or data
     * @param direction the direction in which to inspect, eg: SixDirection.Forward
     */
    //% help=agent/inspect
    //% promise
    //% group="Actions" weight=210 blockGap=30
    //% blockId=minecraftAgentInspect block="agent inspect %kind|%direction"
    //% shim=agent::inspectAsync promise
    function inspect(kind: AgentInspection, direction: SixDirection): number;

    /**
     * Transfers items from an inventory slot to another slot
     * @param quantity the quantity of items to transfer, eg: 1
     * @param sourceSlot the source slot index, from 1 to 27, eg: 1
     * @param destinationSlot the inventory slot in which to drop the items, from 1 to 27, eg:2
     */
    //% help=agent/transfer
    //% promise
    //% group="Inventory" weight=140 blockGap=30
    //% blockId=minecraftAgentTransfer block="agent transfer|amount %quantity|from slot %srcSlot|to slot %destinationSlot"
    //% inlineInputMode="inline"
    //% quantity.min=1 quantity.max=64 sourceSlot.min=1 sourceSlot.max=27 destinationSlot.min=1 destinationSlot.max=27
    //% shim=agent::transferAsync promise
    function transfer(quantity: number, sourceSlot: number, destinationSlot: number): void;

    /**
     * Drops an item from the inventory
     * @param slot the slot from which the item will be dropped, from 1 to 27, eg: 1
     * @param direction the direction in which to drop the item, eg: SixDirection.Back
     * @param quantity the quantity of items to drop, eg: 1
     */
    //% help=agent/drop
    //% promise
    //% group="Inventory" weight=150
    //% blockId=minecraftAgentDrop block="agent drop %direction|from slot %slot|amount %amount"
    //% inlineInputMode="inline"
    //% quantity.min=1 quantity.max=64 slot.min=1 slot.max=27
    //% shim=agent::dropAsync promise
    function drop(direction: SixDirection, slot: number, quantity: number): void;

    /**
     * Gets the number of items in the specified slot
     * @param slot the slot index for which to count items, from 1 to 27, eg: 1
     */
    //% help=agent/get-item-count
    //% promise
    //% group="Inventory" weight=130
    //% blockId=minecraftAgentGetItemCount block="agent get item count from slot %slot"
    //% slot.min=1 slot.max=27
    //% shim=agent::getItemCountAsync promise
    function getItemCount(slot: number): number;

    /**
     * Gets the remaining space in the specified slot
     * @param slot the slot index for which to count the remaining space, from 1 to 27, eg: 1
     */
    //% help=agent/get-item-space
    //% promise
    //% group="Inventory" weight=110
    //% blockId=minecraftAgentGetItemSpace block="agent get remaining space in slot %slot"
    //% slot.min=1 slot.max=27
    //% shim=agent::getItemSpaceAsync promise
    function getItemSpace(slot: number): number;

    /**
     * Gets the ID of the item in the specified inventory slot of the agent
     * @param slot the slot index for which to return the item info, from 1 to 27, eg: 1
     */
    //% help=agent/get-item-detail
    //% promise
    //% group="Inventory" weight=120
    //% blockId=minecraftAgentGetItemDetail block="agent get item id from slot %slot"
    //% slot.min=1 slot.max=27
    //% shim=agent::getItemDetailAsync promise
    function getItemDetail(slot: number): number;

    /**
     * Teleports the agent to the player
     */
    //% help=agent/teleport-to-player
    //% promise
    //% weight=380
    //% blockId=minecraftAgentTeleport block="agent teleport to player"
    //% topblock topblockWeight=65
    //% shim=agent::teleportToPlayerAsync promise
    function teleportToPlayer(): void;

    /**
     * Teleports the agent to the specified coordinates facing the specified orientation
     * @param pos the position to teleport the agent to
     * @param dir the compass direction the agent should face after teleporting
     */
    //% help=agent/teleport
    //% promise
    //% weight=330
    //% blockId=minecraftAgentTeleportPos block="agent teleport to $pos=minecraftCreatePosition|facing $dir"
    //% shim=agent::teleportAsync promise
    function teleport(pos: Position, dir: CompassDirection): void;

}
declare namespace blocks {
    /**
     * Places a block in the world
     * @param block the block to place
     * @param pos the position at which to place the block
     */
    //% help=blocks/place
    //% promise
    //% weight=360
    //% blockId=minecraftPlace block="place %block=minecraftBlock|at %pos=minecraftCreatePosition"
    //% block.shadow=minecraftBlockField
    //% topblock topblockWeight=85
    //% shim=blocks::placeAsync promise
    function place(block: number, pos: Position): void;

    /**
     * Fills a volume between two positions
     * @param block the block to fill the volume with
     * @param from the first corner of the cubic region
     * @param to the opposite corner of the cubic region
     * @param operator= handling for existing blocks in the specified region
     */
    //% help=blocks/fill
    //% promise
    //% weight=250
    //% blockId=minecraftFill block="fill with %block=minecraftBlock|from %from=minecraftCreatePosition|to %to=minecraftCreatePosition|%operator" blockExternalInputs=1
    //% block.shadow=minecraftBlockField
    //% shim=blocks::fillAsync promise
    function fill(block: number, from: Position, to: Position, operator?: FillOperation): void;

    /**
     * Runs code when a certain type of block is placed
     * @param block the type of block that should trigger this code when placed
     */
    //% help=blocks/on-block-placed
    //% promise
    //% weight=350
    //% blockId=minecraftOnBlockPlaced block="on %block=minecraftBlock|placed"
    //% block.shadow=minecraftBlockField
    //% shim=blocks::onBlockPlacedAsync promise
    function onBlockPlaced(block: number, handler: () => void): void;

    /**
     * Runs code when a certain type of block is mined or broken
     * @param block the type of block that should trigger this code when broken
     */
    //% help=blocks/on-block-broken
    //% promise
    //% weight=340
    //% blockId=minecraftOnBlockBroken block="on %block=minecraftBlock|broken"
    //% block.shadow=minecraftBlockField
    //% shim=blocks::onBlockBrokenAsync promise
    function onBlockBroken(block: number, handler: () => void): void;

    /**
     * Replaces all the blocks of a certain type inside the specified region with a new block type
     * @param newblock the new block type that will replace existing blocks
     * @param oldblock the block type that will be replaced by the new block type
     * @param from the first corner of the cubic region
     * @param to the opposite corner of the cubic region
     */
    //% help=blocks/replace
    //% promise
    //% weight=130
    //% blockId=minecraftReplace block="replace with %newblock=minecraftBlock|when block is %oldblock=minecraftBlock|from %from=minecraftCreatePosition|to %to=minecraftCreatePosition" blockExternalInputs=1
    //% newblock.shadow=minecraftBlockField
    //% oldblock.shadow=minecraftBlockField
    //% shim=blocks::replaceAsync promise
    function replace(newblock: number, oldblock: number, from: Position, to: Position): void;

    /**
     * Clones a cubic region into a different location
     * @param begin the first corner of the cubic region
     * @param end the opposite corner of the cubic region
     * @param destination the first corner of the destination region
     * @param mask how to handle air blocks
     * @param mode how to handle the cloned region
     */
    //% help=blocks/clone
    //% promise
    //% weight=120
    //% blockId=minecraftClone block="clone from %begin=minecraftCreatePosition|to %end=minecraftCreatePosition|into %destination=minecraftCreatePosition|mask %mask|mode %mode" blockExternalInputs=1
    //% shim=blocks::cloneAsync promise
    function clone(begin: Position, end: Position, destination: Position, mask: CloneMask, mode: CloneMode): void;

    /**
     * Clones a cubic region into a different location, if the blocks in the region match a certain block type
     * @param begin the first corner of the cubic region
     * @param end the opposite corner of the cubic region
     * @param destination the first corner of the destination region
     * @param block the block type to look for when cloning
     * @param mode how to handle the cloned region
     */
    //% help=blocks/clone-filtered
    //% promise
    //% weight=110
    //% blockId=minecraftCloneFiltered block="clone from %begin=minecraftCreatePosition|to %end=minecraftCreatePosition|into %destination=minecraftCreatePosition|filtered by %block=minecraftBlock|mode %mode"
    //% block.shadow=minecraftBlockField
    //% blockExternalInputs=1
    //% shim=blocks::cloneFilteredAsync promise
    function cloneFiltered(begin: Position, end: Position, destination: Position, block: number, mode: CloneMode): void;

    /**
     * Tests whether the block at the specified coordinate is of a certain type
     * @param block the type of the block to test for
     * @param pos the coordinates where the block should be
     */
    //% help=blocks/test-for-block
    //% promise
    //% weight=310 blockGap=60
    //% blockId=minecraftTestForBlock block="test for %block=minecraftBlock|at %pos=minecraftCreatePosition"
    //% block.shadow=minecraftBlockField
    //% shim=blocks::testForBlockAsync promise
    function testForBlock(block: number, pos: Position): boolean;

    /**
     * Tests whether the blocks in two regions match.
     */
    //% promise
    //% shim=blocks::testForBlocksAsync promise
    function testForBlocks(begin: Position, end: Position, destination: Position, mask?: TestForBlocksMask): boolean;

    /**
     * Represents a block from the game
     * @param block the block
     */
    //% help=blocks/block
    //% blockGap=8
    //% weight=330
    //% blockId=minecraftBlock block="%block"
    //% block.fieldEditor="gridpicker"
    //% block.fieldOptions.width=340 block.fieldOptions.columns=8 block.fieldOptions.tooltips=true
    //% block.fieldOptions.tooltipsXOffset="20" block.fieldOptions.tooltipsYOffset="-20"
    //% block.fieldOptions.maxRows="8"
    //% block.fieldOptions.hasSearchBar=true
    //% block.fieldOptions.hideRect=true
    //% shim=blocks::block
    function block(block: Block): number;

    /**
     * Represents an item from the game
     * @param item the item
     */
    //% help=blocks/item
    //% weight=320
    //% blockId=minecraftItem block="item %item"
    //% item.fieldEditor="gridpicker"
    //% item.fieldOptions.width=340 item.fieldOptions.columns=8 item.fieldOptions.tooltips=true
    //% item.fieldOptions.tooltipsXOffset="20" item.fieldOptions.tooltipsYOffset="-20"
    //% item.fieldOptions.maxRows="8"
    //% item.fieldOptions.hasSearchBar=true
    //% item.fieldOptions.hideRect=true
    //% shim=blocks::item
    function item(item: Item): number;

    /**
     * Represents a block or item from the game with a data value
     * @param b the block or item
     * @param data the data value for the block or item
     */
    //% help=blocks/block-with-data
    //% weight=230
    //% blockId=minecraftBlockData block="%block=minecraftBlock|with data %data"
    //% block.shadow=minecraftBlockField
    //% shim=blocks::blockWithData
    function blockWithData(b: number, data: number): number;

    /**
     * Represents a block or item from the game by its value ID
     * @param id the ID of the block or item from the game
     */
    //% help=blocks/block-by-id
    //% weight=220
    //% blockId=minecraftBlockID block="block by ID %id"
    //% shim=blocks::blockById
    function blockById(id: number): number;

    /**
     * Represents a block or item from the game by its code name
     * @param name the name of the block, eg: "stone"
     */
    //% help=blocks/block-by-name
    //% weight=210 blockGap=60
    //% blockId=minecraftBlockName block="block by name %name"
    //% shim=blocks::blockByName
    function blockByName(name: string): number;

    /**
     * Represents a colored block from the game
     * @param type the type of block, either wool or concrete
     * @param color the color of the block
     */
    //% help=blocks/color-to-block
    //% weight=1
    //% blockId=minecraftBlocksColorToBlock block="%type|of color %color=minecraftBlocksColor"
    //% deprecated=true
    //% shim=blocks::colorToBlock
    function colorToBlock(type: ColoredBlock, color: number): number;

    /**
     * Returns the color value of known block colors
     * @param color the color
     */
    //% help=blocks/color
    //% weight=1
    //% blockId=minecraftBlocksColor block="%color"
    //% deprecated=true
    //% shim=blocks::color
    function color(color: BlockColor): number;

    /**
     * Creates a repeater in a particular state
     * @param direction the direction which the repeater is facing
     * @param delay the delay for the repeater, in game ticks
     */
    //% help=blocks/repeater
    //% weight=150
    //% delay.min=1 delay.max=4
    //% blockId=minecraftBlockRepeater block="repeater|facing %direction|delay %ticks"
    //% shim=blocks::repeater
    function repeater(direction: CompassDirection, delay: number): number;

    /**
     * Creates a lever in a particular state
     * @param position the position state of the lever
     */
    //% help=blocks/lever
    //% weight=160
    //% blockId=minecraftBlockLever block="lever %position"
    //% shim=blocks::lever
    function lever(position: LeverPosition): number;

    /**
     * Creates a comparator in a particular state
     * @param direction the direction which the comparator is facing
     * @param mode the comparison mode of the comparator
     */
    //% help=blocks/comparator
    //% weight=140
    //% blockId=minecraftBlockComparator block="comparator facing %direction|mode %mode"
    //% inlineInputMode="external"
    //% shim=blocks::comparator
    function comparator(direction: CompassDirection, mode: ComparatorMode): number;

}
declare namespace Math {
    /**
     * Exposes JavaScript's isNaN() function
     * @param n
     */
    //%
    //% shim=Math::isNaN
    function isNaN(n: number): boolean;

    /**
     * Constrains a number to be within a range
     * @param value the number to constrain, all data types
     * @param low the lower end of the range, all data types
     * @param high the upper end of the range, all data types
     */
    //%
    //% shim=Math::constrain
    function constrain(value: number, low: number, high: number): number;

    /**
     * Re-maps a number from one range to another. That is, a value of ``from low`` would get mapped to ``to low``, a value of ``from high`` to ``to high``, values in-between to values in-between, etc.
     * @param value value to map in ranges
     * @param fromLow the lower bound of the value's current range
     * @param fromHigh the upper bound of the value's current range, eg: 1023
     * @param toLow the lower bound of the value's target range
     * @param toHigh the upper bound of the value's target range, eg: 4
     */
    //%
    //% shim=Math::map
    function map(value: number, fromLow: number, fromHigh: number, toLow: number, toHigh: number): number;

}
declare namespace gameplay {
    /**
     * Change the game mode for the selected players
     * @param mode the desired game mode, eg: GameMode.Survival
     * @param player a selector to determine which players to change the game mode for
     */
    //% help=gameplay/set-game-mode
    //% promise
    //% weight=210 blockGap=60
    //% blockId=minecraftGamemode block="change game mode to %mode|for %player=minecraftTarget"
    //% blockExternalInputs=1
    //% shim=gameplay::setGameModeAsync promise
    function setGameMode(mode: GameMode, player: TargetSelector): void;

    /**
     * Set the current time of day to a preset time or a custom hour, in game ticks
     * @param time the desired time of day, eg: DayTime.Day
     */
    //% help=gameplay/time-set
    //% promise
    //% weight=320
    //% blockId=minecraftTimeSet block="time set %time=minecraftTime"
    //% shim=gameplay::timeSetAsync promise
    function timeSet(time: number): void;

    /**
     * Add ticks to the current time of day
     * @param amount the number of ticks to add to the current time of day, eg: 100
     */
    //% help=gameplay/time-add
    //% promise
    //% weight=310 blockGap=60
    //% blockId=minecraftTimeAdd block="time add %amount"
    //% shim=gameplay::timeAddAsync promise
    function timeAdd(amount: number): void;

    /**
     * Get the current time of day, in game ticks
     * @param query the type of time to query
     */
    //% help=gameplay/time-query
    //% promise
    //% weight=130
    //% blockId=minecraftTimeQuery block="time query %query"
    //% shim=gameplay::timeQueryAsync promise
    function timeQuery(query: TimeQuery): number;

    /**
     * Represents a preset time of the day
     * @param time a preset time, eg: DateTime.Day
     */
    //% blockId=minecraftTime block="%time" blockHidden=1
    //% weight=2
    //% shim=gameplay::time
    function time(time: DayTime): number;

    /**
     * Change the current weather.
     * @param weather the desired weather, eg: Weather.Clear
     */
    //% help=gameplay/set-weather
    //% promise
    //% weight=340
    //% blockId=minecraftWeather block="weather %weather"
    //% shim=gameplay::setWeatherAsync promise
    function setWeather(weather: Weather): void;

    /**
     * Starts raining if it isn't, or stops raining if it is.
     */
    //% help=gameplay/toggle-downfall
    //% promise
    //% weight=330
    //% blockId=minecraftToggleDownfall block="toggle downfall"
    //% shim=gameplay::toggleDownfallAsync promise
    function toggleDownfall(): void;

    /**
     * Give experience points to the selected players
     * @param amount the number of experience points to give, eg: 10
     * @param target a selector to determine which players to give experience points to
     */
    //% help=gameplay/xp
    //% promise
    //% weight=120
    //% blockId=minecraftXp block="xp give %amount|to %target=minecraftTarget"
    //% shim=gameplay::xpAsync promise
    function xp(amount: number, target: TargetSelector): void;

    /**
     * Enable or disable a game rule
     * @param rule the game rule to change, eg: GameRule.PvP
     * @param enabled whether the specified rule is enabled or not
     */
    //% help=gameplay/set-game-rule
    //% promise
    //% weight=110
    //% blockId=minecraftGameRule block="change game rule %rule|to %enabled"
    //% shim=gameplay::setGameRuleAsync promise
    function setGameRule(rule: GameRule, enabled: boolean): void;

    /**
     * Change whether the world can be altered or not
     * @param enabled true if modifying the world is allowed, false if not
     */
    //% help=gameplay/immutable-world
    //% promise
    //% blockId=minecraftImmutableWorld block="immutable world %enabled"
    //% deprecated=true weight=1
    //% shim=gameplay::immutableWorldAsync promise
    function immutableWorld(enabled: boolean): void;

    /**
     * Changes the game difficulty
     * @param difficulty the new difficulty
     */
    //% help=gameplay/set-difficulty
    //% promise
    //% weight=220
    //% blockId=setDifficulty block="set difficulty to %difficulty"
    //% shim=gameplay::setDifficultyAsync promise
    function setDifficulty(difficulty: GameDifficulty): void;

    /**
     * Shows a title and subtitle to the selected targets
     * @param target the players and entities to select
     * @param title the large title to display
     * @param subTitle the subtitle to display
     */
    //% help=gameplay/title
    //% promise
    //% weight=200
    //% blockId=minecraftTitle block="show %target=minecraftTarget|title %title|subtitle %subTitle"
    //% shim=gameplay::titleAsync promise
    function title(target: TargetSelector, title: string, subTitle: string): void;

    /**
     * Closes the chat window if it is open (EE only)
     */
    //% promise
    //% shim=gameplay::dismissChatAsync promise
    function dismissChat(): void;

}
declare namespace blocks {
    /**
     * Creates the specified text in the game world, made of the specified block, at the given location
     * @param text the text to print in the world, eg: "HELLO"
     * @param block the block type that will be used to create the text
     * @param position the coordinates where the text will be printed in the world
     * @param direction the axis along which the text will be printed
     */
    //% help=blocks/print
    //% weight=240
    //% blockId=minecraftPrintAsync block="print %text|of %block=minecraftBlock|at %position=minecraftCreatePosition|along %direction"
    //% block.shadow=minecraftBlockField
    //% blockExternalInputs=1
    //% text.shadowOptions.toString=true
    //% shim=blocks::printAsync promise
    function print(text: string, block: number, position: Position, direction: CompassDirection): void;

}
declare namespace loops {
    /**
     * Repeat the code forever in the background. On each iteration, allow other code to run.
     * @param body code to repeat forever
     */
    //% help=loops/forever weight=55 blockAllowMultiple=true
    //% blockId=device_forever block="forever" icon="\uf01e" blockGap=24
    //% shim=loops::forever
    function forever(body: () => void): void;

    /**
     * Pause for the specified time in milliseconds
     * @param ms how long to pause for, eg: 100, 200, 500, 1000, 2000
     */
    //% help=loops/pause weight=54 blockGap=24
    //% async block="pause (ms) %pause"
    //% blockId=device_pause icon="\uf110"
    //% shim=loops::pause
    function pause(ms: number): void;

    /**
     * Run this code in parallel with the current code
     */
    //% blockId=fork icon="\uf110" block="run in background"
    //% help=loops/run-in-background weight=0
    //% shim=loops::runInBackground
    function runInBackground(handler: () => void): void;

}
declare namespace mobs {
    /**
     * Summons a creature at a given location
     * @param mob the type of creature to summon
     * @param destination the coordinates at which to summon the creature
     */
    //% help=mobs/spawn
    //% promise
    //% weight=350
    //% blockId=minecraftSummon block="spawn %entity=minecraftAnimal|at %destination=minecraftCreatePosition"
    //% entity.shadow=minecraftAnimal
    //% topblock topblockWeight=80
    //% shim=mobs::spawnAsync promise
    function spawn(mob: number, destination: Position): void;

    /**
     * Runs code when a creature of a certain type is killed
     * @param mob the type of creature
     */
    //% help=mobs/on-mob-killed
    //% weight=340
    //% blockId=minecraftMobKilled block="on %mob=minecraftAnimal|killed"
    //% mob.shadow=minecraftAnimal
    //% shim=mobs::onMobKilledAsync promise
    function onMobKilled(mob: number, handler: () => void): void;

    /**
     * Applies a status effect to the specified target
     * @param target a target selector that determines which entity will receive the effect
     * @param effect the effect to apply
     * @param duration the duration of the effect
     * @param amplifier the amplifier of the effect
     */
    //% promise
    //% weight=0
    //% blockId=minecraftEffect block="apply %effect to %target=minecraftTarget||duration %duration amplifier %amplifier"
    //% expandableArgumentMode=toggle
    //% duration.min=0 duration.max=600 duration.defl=10
    //% amplifier.min=0 amplifier.max=255 amplifier.defl=1
    //% inlineInputMode="inline"
    //% effect.fieldEditor="gridpicker"
    //% effect.fieldOptions.width=340 effect.fieldOptions.columns=8 effect.fieldOptions.tooltips=true
    //% effect.fieldOptions.tooltipsXOffset="20" effect.fieldOptions.tooltipsYOffset="-20"
    //% effect.fieldOptions.maxRows="8"
    //% effect.fieldOptions.hasSearchBar=true
    //% effect.fieldOptions.hideRect=true
    //% deprecated=true
    //% shim=mobs::effectAsync promise
    function effect(effect: Effect, target: TargetSelector, duration?: number, amplifier?: number): void;

    /**
     * Applies a status effect to the specified target
     * @param target a target selector that determines which entity will receive the effect
     * @param effect the effect to apply
     * @param duration the duration of the effect
     * @param amplifier the amplifier of the effect
     */
    //% promise
    //% weight=270 help=mobs/apply-effect
    //% blockId=minecraftApplyEffect block="apply %effect=minecraftEffectField|to %target=minecraftTarget|duration %duration amplifier %amplifier"
    //% duration.min=0 duration.max=600 duration.defl=10
    //% amplifier.min=0 amplifier.max=255 amplifier.defl=1
    //% inlineInputMode="inline"
    //% shim=mobs::applyEffectAsync promise
    function applyEffect(effect: number, target: TargetSelector, duration?: number, amplifier?: number): void;

    /**
     * Clears all status effects from the specified target
     * @param target a target selector that determines which entity will be cleared of effects
     */
    //% promise
    //% weight=260 help=mobs/clear-effect
    //% blockId=minecraftClearEffect block="clear all effects from %target=minecraftTarget"
    //% shim=mobs::clearEffectAsync promise
    function clearEffect(target: TargetSelector): void;

    /**
     * Gives blocks or items from the game to the specified players
     * @param target a target selector that determines which players will receive the block or item
     * @param block the block or item to give
     * @param amount the quantity to give, eg: 1
     */
    //% help=mobs/give
    //% promise
    //% weight=240
    //% blockId=minecraftGive block="give %target=minecraftTarget|block or item %block=minecraftBlock|amount %amount"
    //% block.shadow=minecraftBlockField
    //% blockExternalInputs=1
    //% shim=mobs::giveAsync promise
    function give(target: TargetSelector, block: number, amount: number): void;

    /**
     * Teleports entities to another location
     * @param target a target selector that determines which entities will be teleported
     * @param destination the coordinates where the selected entities will be teleported to
     */
    //% help=mobs/teleport-to-position
    //% promise
    //% weight=230
    //% blockId=minecraftTeleport block="teleport %target=minecraftTarget|to %destination=minecraftCreatePosition"
    //% blockExternalInputs=1
    //% shim=mobs::teleportToPositionAsync promise
    function teleportToPosition(target: TargetSelector, destination: Position): void;

    /**
     * Teleports entities to a player
     * @param target a target selector that determines which entities will be teleported
     * @param destination a target selector that determines which player the entities will be teleported to
     */
    //% help=mobs/teleport-to-player
    //% promise
    //% weight=220
    //% blockId=minecraftTeleportToPlayer block="teleport %target=minecraftTarget|to %destination=minecraftTarget"
    //% blockExternalInputs=1
    //% shim=mobs::teleportToPlayerAsync promise
    function teleportToPlayer(target: TargetSelector, destination: TargetSelector): void;

    /**
     * Applies a certain enchantment to the specified targets
     * @param target a target selector that determines which players will receive the enchantment
     * @param spell the code name of the enchantment, eg: "infinity"
     * @param level the strength level of the enchantment, eg: 1
     */
    //% help=mobs/enchant
    //% promise
    //% weight=210 blockGap=60
    //% blockId=minecraftEnchant block="enchant %target=minecraftTarget|with %spell|of level %level"
    //% inlineInputMode="external"
    //% shim=mobs::enchantAsync promise
    function enchant(target: TargetSelector, spell: string, level: number): void;

    /**
     * Kills the selected entities
     * @param target a target selector that determines which entities will be killed
     */
    //% help=mobs/kill
    //% promise
    //% weight=330
    //% blockId=minecraftKill block="kill %target=minecraftTarget"
    //% blockExternalInputs=1
    //% shim=mobs::killAsync promise
    function kill(target: TargetSelector): void;

    /**
     * Executes a command as other targets
     * @param target a target selector that determines which entities will execute the command
     * @param position the coordinates from which to run the command
     * @param command the full command which the selected targets will execute, eg: "say Hi!"
     */
    //% help=mobs/execute
    //% weight=110 blockGap=30
    //% blockId=minecraftExecuteAsOther block="execute as %target=minecraftTarget|at %position=minecraftCreatePosition|command %command"
    //% blockExternalInputs=1
    //% shim=mobs::executeAsync promise
    function execute(target: TargetSelector, position: Position, command: string): void;

    /**
     * Executes a command if a certain block type is detected at the specified position
     * @param detectPosition the position at which to detect the block
     * @param detectBlock the block type to test for
     * @param command the full command which the selected targets will execute if the specified block is successfully detected, eg: "say Hi!"
     */
    //% help=mobs/execute-detect
    //% weight=120
    //% blockId=minecraftExecuteDetect block="detect block %block=minecraftBlock|at %detectPosition=minecraftCreatePosition|if found, run command %command"
    //% block.shadow=minecraftBlockField
    //% blockExternalInputs=1
    //% shim=mobs::executeDetectAsync promise
    function executeDetect(detectBlock: number, detectPosition: Position, command: string): void;

    /**
     * Represents an animal from the game
     * @param name the type of the animal
     */
    //% help=mobs/animal
    //% weight=320
    //% blockId=minecraftAnimal block="animal %name"
    //% name.fieldEditor="gridpicker"
    //% name.fieldOptions.width=340 name.fieldOptions.columns=8 name.fieldOptions.tooltips=true
    //% name.fieldOptions.maxRows="8"
    //% name.fieldOptions.hideRect=true
    //% shim=mobs::animal
    function animal(name: AnimalMob): number;

    /**
     * Represents a monster from the game
     * @param name the type of the monster
     */
    //% help=mobs/monster
    //% blockId=minecraftMonster block="monster %name"
    //% weight=310
    //% name.fieldEditor="gridpicker"
    //% name.fieldOptions.width=340 name.fieldOptions.columns=8 name.fieldOptions.tooltips=true
    //% name.fieldOptions.maxRows="8"
    //% name.fieldOptions.hideRect=true
    //% shim=mobs::monster
    function monster(name: MonsterMob): number;

    /**
     * Represents a projectile from the game
     * @param name the type of the projectile
     */
    //% help=mobs/projectile
    //% blockId=minecraftProjectile block="projectile %name"
    //% weight=305 blockGap=60
    //% shim=mobs::projectile
    function projectile(name: ProjectileMob): number;

}
declare namespace player {
    /**
     * Returns the name of the current player (you)
     */
    //% help=player/name
    //% weight=240
    //% blockId=minecraftMyName block="player name"
    //% shim=player::name
    function name(): string;

    /**
     * Posts a message to the game chat
     * @param message the message to display in the chat, eg: "Hi!"
     */
    //% help=player/say
    //% promise
    //% weight=340
    //% blockId=minecraftSay block="say %message"
    //% message.shadowOptions.toString=true
    //% shim=player::sayAsync promise
    function say(message: string): void;

    /**
     * Whispers a message to targets
     * @param target a selector of entities
     * @param message the text to whisper, eg: "Hi!"
     */
    //% help=player/tell
    //% promise
    //% weight=220
    //% blockId=minecraftTell block="tell %target=minecraftTarget|%message"
    //% inlineInputMode="inline"
    //% message.shadowOptions.toString=true
    //% shim=player::tellAsync promise
    function tell(target: TargetSelector, message: string): void;

    /**
     * Teleports the current player to another position
     * @param to the destination position
     */
    //% help=player/teleport
    //% promise
    //% weight=330
    //% blockId=minecraftPlayerTeleport block="teleport to %to=minecraftCreatePosition"
    //% shim=player::teleportAsync promise
    function teleport(to: Position): void;

    /**
     * Gets the last message, if any
     */
    //%
    //% shim=player::message
    function message(): string;

    /**
     * Runs code when another player whispers you a certain message
     * @param command the chat keyword that will be associated with this command (``*`` for all messages), eg: "jump"
     */
    //% help=player/on-tell-command
    //% promise
    //% weight=120
    //% blockId=minecraftOnTellCommand block="on tell command %command"
    //% shim=player::onTellCommandAsync promise
    function onTellCommand(command: string, handler: () => void): void;

    /**
     * Executes a chat command in your code
     * @param command the chat command to run, eg: "jump"
     */
    //% help=player/run-chat-command
    //% weight=140
    //% blockId=minecraftRunChatCommand block="run chat command %command"
    //% shim=player::runChatCommand
    function runChatCommand(command: string): void;

    /**
     * Executes a chat command in your code with arguments
     * @param command the chat command to run, eg: "jump"
     * @param arg a string containing all the arguments you wish to give to the chat command
     */
    //% help=player/run-chat-command-with-args
    //% weight=130
    //% blockId=minecraftRunChatCommandArgs block="run chat command %command|with %arg"
    //% arg.shadowOptions.toString=true
    //% shim=player::runChatCommandWithArguments
    function runChatCommandWithArguments(command: string, arg: string): void;

    /**
     * Runs code when the current player dies
     */
    //% help=player/on-died
    //% promise
    //% weight=310 blockGap=60
    //% blockId=minecraftPlayerDied block="on player died"
    //% shim=player::onDiedAsync promise
    function onDied(handler: () => void): void;

    /**
     * Runs code when the current player travels in a certain way
     * @param method the travel method
     */
    //% help=player/on-travelled
    //% promise
    //% weight=320
    //% blockId=minecraftPlayerTravelled block="on player %method"
    //% topblock topblockWeight=90
    //% shim=player::onTravelledAsync promise
    function onTravelled(method: TravelMethod, handler: () => void): void;

    /**
     * Runs code when the current player gets teleported
     */
    //% help=player/on-teleported
    //% promise
    //% weight=110
    //% blockId=minecraftPlayerOnTeleported block="on player teleported"
    //% shim=player::onTeleportedAsync promise
    function onTeleported(handler: () => void): void;

    /**
     * Runs code when the current player bounces on a slime
     */
    //% help=player/on-bounced
    //% promise
    //% weight=1
    //% blockId=minecraftPlayerBounced block="on player bounced"
    //% deprecated=true
    //% shim=player::onBouncedAsync promise
    function onBounced(handler: () => void): void;

    /**
     * Runs code when a picture is taken with a camera
     */
    //% help=player/on-camera-used
    //% promise
    //% weight=1
    //% blockId=minecraftOnCameraUsed block="on camera used"
    //% deprecated=true
    //% shim=player::onCameraUsedAsync promise
    function onCameraUsed(handler: () => void): void;

    /**
     * Runs code when the current player shoots an arrow
     */
    //% help=player/on-arrow-shot
    //% promise
    //% weight=210 blockGap=60
    //% blockId=minecraftOnArrowShot block="on arrow shot"
    //% shim=player::onArrowShotAsync promise
    function onArrowShot(handler: () => void): void;

    /**
     * Returns the world position of the current player
     */
    //% help=player/position
    //% promise
    //% weight=250
    //% blockId=minecraftMyPosition block="player world position"
    //% shim=player::positionAsync promise
    function position(): Position;

    /**
     * Executes a game command as the current player
     * @param command the slash command to execute (you do not have to put the leading ``/``), eg: "say Hi!"
     */
    //% help=player/execute
    //% promise
    //% weight=230
    //% blockId=minecraftExecute block="execute %command"
    //% blockExternalInputs=1
    //% shim=player::executeAsync promise
    function execute(command: string): void;

    /**
     * Runs code when a keyword is typed in the chat
     * @param command the chat keyword that will be associated with this command (``*`` for all messages), eg: "jump"
     */
    //%
    //% shim=player::onChatCommandCoreAsync promise
    function onChatCommandCore(command: string, handler: () => void): void;

    /**
     * Runs code when an item is used
     */
    //% help=player/on-item-used
    //% promise
    //% weight=350
    //% blockId=minecraftOnItemInteracted block="on $item|used"
    //% item.shadow=minecraftItem
    //% shim=player::onItemInteractedAsync promise
    function onItemInteracted(item: number, handler: () => void): void;

    /**
     * Gets the specified argument from the latest player chat message
     * @param index
     */
    //%
    //% shim=player::getChatArg
    function getChatArg(index: number): string;

    /**
     * Gets the arguments for the specified command
     * @param command the chat command for which to get the args
     */
    //%
    // NOTE: This returns a RefCollection, but because of the way our sim typings are set up, we cannot declare
    // RefCollection as the return type. We instead use string[] in the signature, while actually returning a
    // RefCollection cast as <any>.
    //% shim=player::getChatArgs
    function getChatArgs(command: string): string[];

    /**
     * Displays a chat command help message in the game chat.
     *
     * @param helpStr The formatted syntax of the command
     */
    //% promise
    //% shim=player::chatCommandSyntaxErrorAsync promise
    function chatCommandSyntaxError(helpStr: string): void;

    /**
     * Displays an error in the game chat
     *
     * @param msg The error to display in the game chat
     */
    //% promise
    //% shim=player::errorMessageAsync promise
    function errorMessage(msg: string, multiline?: boolean): void;

}
declare namespace positions {
    /**
     * Creates a new position by adding the two specified positions
     * @param p1 the first position to add
     * @param p2 the second position to add
     */
    //% help=positions/add
    //% weight=220
    //% blockId=minecraftAddPosition block="%p1=minecraftCreatePosition|+ %p2=minecraftCreatePosition"
    //% blockExternalInputs=1
    //% shim=positions::add
    function add(p1: Position, p2: Position): Position;

    /**
     * Creates a new relative position: ~East/West, ~up/down, ~South/North
     * @param x the East (+x) or West (-x) coordinate, in blocks
     * @param y the up (+y) or down (-y) coordinate, in blocks
     * @param z the South (+z) or North (-z) coordinate, in blocks
     */
    //% help=positions/create
    //% weight=320
    //% blockId=minecraftCreatePosition block="~%x|~%y|~%z"
    //% shim=positions::create
    function create(x: number, y: number, z: number): Position;

    /**
     * Creates a new world position: East/West, up/down, South/North
     * @param x the East (+x) or West (-x) coordinate, in blocks
     * @param y the up (+y) or down (-y) coordinate, in blocks
     * @param z the South (+z) or North (-z) coordinate, in blocks
     */
    //% help=positions/create-world
    //% weight=310 blockGap=60
    //% blockId=minecraftCreateWorldPosition block="world %x|%y|%z"
    //% shim=positions::createWorld
    function createWorld(x: number, y: number, z: number): Position;

    /**
     * Creates a new position with a mix of relative and absolute coordinates
     * @param x the East (+x) or West (-x) coordinate, in blocks
     * @param y the up (+y) or down (-y) coordinate, in blocks
     * @param z the South (+z) or North (-z) coordinate, in blocks
     */
    //%
    //% shim=positions::createHybrid
    function createHybrid(xRaw: string, yRaw: string, zRaw: string): Position;

    /**
     * Picks a random position within the specified cubic region
     * @param p1 the position of the first corner of the cubic region
     * @param p2 the position of the opposite corner of the cubic region
     */
    //% help=positions/random
    //% weight=210 blockGap=60
    //% blockId=minecraftPosRandom block="pick random position|from %p1=minecraftCreatePosition|to %p2=minecraftCreatePosition"
    //% blockExternalInputs=1
    //% shim=positions::random
    function random(p1: Position, p2: Position): Position;

    /**
     * Finds the ground under the given position and returns the coordinates of the next air block just above it. If
     * the given block is solid, the next air block underneath is found, and the scan starts from there. Liquids are
     * considered solid.
     * @param pos the position under which to find the ground
     */
    //% help=positions/ground-position
    //% promise
    //% weight=50
    //% blockId=minecraftNextSolid block="ground at $pos=minecraftCreatePosition"
    //% shim=positions::groundPositionAsync promise
    function groundPosition(pos: Position): Position;

}
    /**
     * A world coordinate that may be relative (~) to the player position.
     */
    //% color=#69B090
    declare class Position {
        /**
         * Returns a string representation of this position
         */
        //% help=positions/to-string
        //% blockId="minecraftPositionToString" block="%position|to string"
        //% blockNamespace=positions weight=110 color=#69B090
        //% blockGap=60
        //% shim=.toString
        public toString(): string;

        /**
         * Adds the offset and returns a new position
         */
        //%
        //% shim=.add
        public add(offset: Position): Position;

        /**
         * Creates a new world position by converting this position to a world position
         */
        //% help=positions/to-world
        //% promise
        //% blockId=minecraftPositionToWorld block="%position|to world"
        //% blockNamespace=positions weight=120 color=#69B090
        //% shim=.toWorldAsync promise
        public toWorld(): Position;

        /**
         * Gets the value of the specified coordinate: x, y or z
         * @param direction the axis for which to return the coordinate value
         */
        //% help=positions/get-value
        //% blockId=minecraftPosGet block="%position|get value of %direction"
        //% blockNamespace=positions weight=130 color=#69B090
        //% shim=.getValue
        public getValue(direction: Axis): number;

        /**
         * Gets a value that indicates if the coordinate is relative to the user
         */
        //%
        //% shim=.isRelative
        public isRelative(direction: Axis): boolean;

        /**
         * Returns a position moved by the given blocks
         */
        //%
        //% shim=.move
        public move(direction: CardinalDirection, blocks: number): Position;

    }
declare namespace mobs {
    /**
     * Selects a set of players or mobs
     * @param kind the type of entities that will be selected
     */
    //% help=mobs/selectors/target
    //% blockId=minecraftTarget block="%kind" weight=99 group="Selectors"
    //% shim=mobs::target
    function target(kind: TargetSelectorKind): TargetSelector;

    /**
     * Selects targets near a given position
     * @param target the type of entities that will be selected
     * @param pos the position near which to select targets
     * @param radius the distance (in blocks) from the specified position within which targets will be selected, eg: 5
     */
    //% help=mobs/selectors/near
    //% blockId=minecraftTargetNear block="%target=minecraftTarget|near to %pos=minecraftCreateWorldPosition|within radius %radios" weight=39
    //% blockExternalInputs=1 group="Selectors"
    //% shim=mobs::near
    function near(target: TargetSelector, pos: Position, radius: number): TargetSelector;

    /**
     * Selects all mobs (animals or monsters) of a given type
     * @param type the type of mob to select
     */
    //% help=mobs/selectors/entities-by-type
    //% blockId=minecraftTargetSelectByType block="all %type=minecraftAnimal" weight=38 group="Selectors"
    //% type.shadow=minecraftAnimal
    //% shim=mobs::entitiesByType
    function entitiesByType(type: number): TargetSelector;

    /**
     * Selects the player with the given name
     * @param name the name of the player to select. eg: name
     */
    //% help=mobs/selectors/player-by-name
    //% blockGap=30
    //% blockId=minecraftTargetSelectName block="player named %name" weight=37 group="Selectors"
    //% shim=mobs::playerByName
    function playerByName(name: string): TargetSelector;

    /**
     * Selects all players in the given game mode
     * @param mode the game mode in which all players will be selected
     */
    //% help=mobs/selectors/player-in-game-mode
    //% blockId=minecraftTargetSelectGameMode block="players in game mode %mode" weight=37 group="Selectors"
    //% shim=mobs::playersInGameMode
    function playersInGameMode(mode: GameMode): TargetSelector;

    /**
     * Parses the given string into a TargetSelector object. This function does not check to make sure
     * arguments are given the correct type or that the names of arguments are valid.
     * @param str the target selector string to parse
     * @returns the parsed TargetSelector object or null if the string was invalid
     */
    //%
    //% shim=mobs::parseSelector
    function parseSelector(str: string): TargetSelector;

}
    /**
     * A target selector
     */
    //%
    declare class TargetSelector {
        /**
         * Sets the base coordinates for this target selector
         * @param p the coordinates at which this selector should be set
         */
        //% help=mobs/selectors/at-coordinates
        //% blockId=minecraftSelectorAtCoordinate block="%selector| set coordinate %p=minecraftCreateWorldPosition"
        //% blockNamespace=mobs weight=30 group="Selectors"
        //% shim=.atCoordinate
        public atCoordinate(p: Position): void;

        /**
         * Sets the maximum distance from this selector's base coordinates
         * @param radius the maximum distance (in blocks) for this target selector, eg: 5
         */
        //% help=mobs/selectors/within-radius
        //% blockId=minecraftSelectorWithinRadius block="%selector| set max radius %r"
        //% blockNamespace=mobs weight=20 group="Selectors"
        //% shim=.withinRadius
        public withinRadius(radius: number): void;

        /**
         * Sets the minimum distance from this selector's base coordinates
         * @param radius the minimum distance (in blocks) for this target selector, eg: 10
         */
        //% help=mobs/selectors/outside-radius
        //% blockId=minecraftSelectorOutsideRadius block="%selector| set min radius %r"
        //% blockNamespace=mobs weight=10 group="Selectors"
        //% shim=.outsideRadius
        public outsideRadius(radius: number): void;

        /**
         * Adds a rule to this target selector
         * @param rule the rule to add, eg: "type"
         * @param value the value for the rule, eg: "chicken"
         */
        //% help=mobs/selectors/add-rule
        //% blockId=minecraftSelectorAddRule block="%selector| add rule %rule| equals %value"
        //% blockNamespace=mobs weight=10 group="Selectors"
        //% shim=.addRule
        public addRule(rule: string, value: string): void;

        /**
         * Returns a string containing the game notation for this target selector
         */
        //% help=mobs/selectors/to-string
        //% blockId=minecraftSelectorToString block="%selector|to string"
        //% blockNamespace=mobs weight=9 group="Selectors"
        //% shim=.toString
        public toString(): string;

    }

// Auto-generated. Do not edit. Really.


/**
 * Give commands, communicate, and respond to events that happen in the game
 */
//% color=#0078D7 weight=100 icon="\uf007"
namespace player {
    export class ChatCommandArguments {
        public number: number;
        public number2: number;
        public string: string;
        public string2: string;
        public position: Position;
        public position2: Position;
        public selector: TargetSelector;
        public selector2: TargetSelector;
    }

    /**
     * Returns the string value of the specified ChatArgument enum value
     * @param argName
     */
    function getArgumentName(argName: ChatArgument): string {
        return "";
    }

    /**
     * Runs code when you type a certain message in the game chat
     * @param command the chat keyword that will be associated with this command (``*`` for all messages), eg: "jump"
     */
    //% help=player/on-chat-command
    //% promise
    //% weight=350
    //% blockId=minecraftOnChatCommand block="on chat command %command"
    //% mutate=objectdestructuring
    //% mutatePropertyEnum=ChatArgument
    //% mutateText="Command arguments"
    //% mutatePrefix="with"
    //% deprecated=true
    export function onChatCommand(command: string, argTypes: ChatArgument[], handler: (args: ChatCommandArguments) => void): void {
    }

    /**
     * Runs code when you type a certain message in the game chat
     * @param command the chat keyword that will be associated with this command (``*`` for all messages), eg: "jump"
     */
    //% help=player/on-chat-command
    //% promise
    //% weight=360
    //% blockId=minecraftOnChat block="on chat command %command"
    //% optionalVariableArgs
    //% topblock topblockWeight=95
    export function onChat(command: string, handler: (num1: number, num2: number, num3: number) => void) {
    }
}
