namespace testNamespace {
    /**
     * Statement functions
     */

    //% blockId=test_no_argument
    //% block="No arg"
    export function noArgument(): void {}

    //% blockId=test_boolean_argument
    //% block="Boolean arg %arg=logic_boolean"
    export function booleanArgument(arg: boolean): void {}

    //% blockId=test_number_argument
    //% block="Number arg %arg"
    export function numberArgument(arg: number): void {}

    //% blockId=test_string_argument
    //% block="String arg %arg"
    export function stringArgument(arg: string): void {}

    //% blockId=test_enum_argument
    //% block="Enum arg %arg=test_enum"
    export function enumArgument(arg: TestEnum): void {}

    //% blockId=test_enum_function_argument
    //% block="Enum function arg %arg=test_enum_value"
    export function enumFunctionArgument(arg: EnumWithValueBlock): void {}

    //% blockId=test_multiple_arguments
    //% block="Multiple args|number %arg1|and boolean %arg2=logic_boolean"
    export function multipleArguments(arg1: number, arg2: boolean): void {}

    //% blockId=test_callback
    //% block="Callback"
    export function withCallback(body: () => void): void {}

    //% blockId=test_callback_with_argument
    //% block="Callback with|enum %arg1|and number %arg2"
    export function withCallbackAndArguments(arg1: TestEnum, arg2: number, body: () => void): void {}


    /**
     * Output functions
     */

    //% blockId=test_no_argument_output
    //% block="Output No arg"
    export function noArgumentOutput(): number { return 0; }

    //% blockId=test_boolean_argument_output
    //% block="Output Boolean arg %arg=logic_boolean"
    export function booleanArgumentOutput(arg: boolean): boolean { return true; }

    //% blockId=test_number_argument_output
    //% block="Output Number arg %arg"
    export function numberArgumentOutput(arg: number): number { return 0; }

    //% blockId=test_string_argument_output
    //% block="Output String arg %arg"
    export function stringArgumentOutput(arg: string): string { return ""; }

    //% blockId=test_enum_argument_output
    //% block="Output Enum arg %arg=test_enum"
    export function enumArgumentOutput(arg: TestEnum): TestEnum { return TestEnum.testValue2; }

    //% blockId=test_enum_function_argument_output
    //% block="Output Enum function arg %arg=test_enum_value"
    export function enumFunctionArgumentOutput(arg: EnumWithValueBlock): EnumWithValueBlock { return arg; }

    //% blockId=test_multiple_argument_output
    //% block="Output Multiple args|number %arg1|and boolean %arg2=logic_boolean"
    export function multipleArgumentsOutput(arg1: number, arg2: boolean): number { return arg1; }


    /**
     * Enum value function
     */

    //% blockId=test_enum_value block="%value|enum"
    export function enumWithValue(value: EnumWithValueBlock): number { return value; }

    /**
     * Class
     */

    //% blockId=test_create_class
    //% block="Create test class with number %x"
    export function createTestClass(x: number): TestClass { return new TestClass(x); }

    export class TestClass {
        constructor(x: number) {}

        //% blockId=test_class_method
        //% block="Some method|on %testClass|with number %x"
        public testMethod(a: number) {}
    }
}

//% color=#A80000 weight=30
namespace namespaceWithCustomColor {
    //% blockId=custom_color_block
    export function someFunction(): void {}
}

enum TestEnum {
    testValue1 = 0,

    //% block=someOtherName
    testValue2 = 5
}

enum EnumWithValueBlock {
    //% block=value1
    testValue1 = 0,

    //% block=value2
    testValue2 = 5
}