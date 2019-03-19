namespace bc {
    /**
     * test class
     **/
    //% blockNamespace=bc color="#4B7BEC" blockGap=8
    export class Test {
        //% group="Properties"
        //% blockCombine block="x (horizontal position)"
        x: number

        //% group="Properties"
        //% blockCombine block="z (depth)"
        get z(): number {
            return 0;
        }

        //% group="Properties"
        //% blockCombine block="z (depth)"
        set z(value: number) {
        }

        //% blockId=testgetter block="%test(mytest) get bool"
        get testgetter(): boolean {
            return false;
        }
    }

    //% blockId=bc_create_test block="create test"
    export function createTest(): Test {
        return new Test();
    }
}