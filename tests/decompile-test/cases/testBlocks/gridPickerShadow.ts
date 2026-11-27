enum TestAnimal {
    //% blockIdentity=gridPickerTest.animal tags=mount
    Chicken = 10,
    //% blockIdentity=gridPickerTest.animal tags="mount excluded"
    Cow = 11
}

enum TestMonster {
    //% blockIdentity=gridPickerTest.monster tags="mount rider"
    Zombie = 32,
    //% blockIdentity=gridPickerTest.monster
    Creeper = 33
}

enum TestTerrain {
    //% blockIdentity=gridPickerTest.terrain tags=mount
    Grass = 10
}

//% blockIdentity=gridPickerTest.animal enumIdentity=TestAnimal.Chicken
const TEST_CHICKEN = TestAnimal.Chicken;
//% blockIdentity=gridPickerTest.animal enumIdentity=TestAnimal.Cow
const TEST_COW = TestAnimal.Cow;
//% blockIdentity=gridPickerTest.monster enumIdentity=TestMonster.Zombie
const TEST_ZOMBIE = TestMonster.Zombie;
//% blockIdentity=gridPickerTest.monster enumIdentity=TestMonster.Creeper
const TEST_CREEPER = TestMonster.Creeper;
//% blockIdentity=gridPickerTest.terrain enumIdentity=TestTerrain.Grass
const TEST_GRASS = TestTerrain.Grass;

namespace gridPickerTest {
    //% blockId=test_grid_picker_animal block="animal $value" shim=TD_ID
    export function animal(value: TestAnimal): number {
        return value;
    }

    //% blockId=test_grid_picker_monster block="monster $value" shim=TD_ID
    export function monster(value: TestMonster): number {
        return value;
    }

    //% blockId=test_grid_picker_terrain block="terrain $value" shim=TD_ID
    export function terrain(value: TestTerrain): number {
        return value;
    }

    //% blockId=test_grid_picker_rider block="$choice" shim=TD_ID blockHidden=1
    //% choice.fieldEditor=gridpicker choice.fieldOptions.enumNames="TestAnimal,TestMonster" choice.fieldOptions.filter=rider
    export function rider(choice: number): number {
        return choice;
    }

    //% blockId=test_grid_picker_mount block="$choice" shim=TD_ID blockHidden=1
    //% choice.fieldEditor=gridpicker choice.fieldOptions.enumNames="TestAnimal,TestMonster" choice.fieldOptions.filter="mount !excluded"
    export function mount(choice: number): number {
        return choice;
    }

    //% blockId=test_grid_picker_jockey block="spawn $rider riding $mount"
    //% rider.shadow=test_grid_picker_rider mount.shadow=test_grid_picker_mount
    export function spawnJockey(rider: number, mount: number): void {
    }
}
