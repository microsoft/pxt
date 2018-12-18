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

    //% blockId=test_number_with_enum_shadow
    //% block="Number with enum shadow %arg1=test_enum_value"
    export function numberWithEnumShadow(arg1: number): void {}

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

    //% blockId=test_single_default_argument
    //% block="Single default arg and|number %arg1"
    export function defaultArguments(arg1: number, arg2 = 500) { }

    //% blockId=test_multi_default_argument
    //% block="Multiple default arguments"
    export function multipleDefaultArguments(arg2 = 500, arg3 = 700) { }

    //% blockId=test_optional_argument
    //% block="Single optional arg and|number %arg1"
    export function optionalArgument(arg1: number, arg2?: number) { }

    //% blockId=test_optional_argument_2
    //% block="Callback with optional arg"
    export function optionalArgumentWithCallback(arg1: () => void, arg2?: number) { }

    //% blockId=test_handler_arguments
    //% block="Handler arguments"
    export function callbackWithArguments(cb: (a: number, b: number) => void) {}

    //% blockId=test_handler_arguments2 optionalVariableArgs=true
    //% block="Handler with optioinal arguments"
    export function callbackWithIgnoredArguments(cb: (c: number, d: number) => void) {}

    //% blockId=test_handler_arguments3 draggableParameters=1
    //% block="Handler with draggable arguments"
    export function callbackWithDraggableParams(cb: (c: number, d: number) => void) {}

    //% blockId=test_handler_arguments4 draggableParameters="reporter"
    //% block="Handler with draggable reporters"
    export function callbackWithDraggableParamsReporters(cb: (c: string, d: number, e: boolean, f: TestClass) => void) {}

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

        //% blockId=test_class_method2
        //% block="Some method|on %testClass|with enum %a"
        public testMethodWithEnum(a: TestEnum) {}
    }

    /**
     * Mutators
     */

    //% blockId=test_rest_parameter
    //% block="rest parameter: "
    //% mutate="restparameter""
    //% mutateText="Number of Values"
    export function restParameterTest(...args: number[]): void { }

    export class SomeBagOfProperties {
        public n: number;
        public text: string;
    }

    //% blockId=test_object_destructuring
    //% block="object destructure: "
    //% mutate="objectdestructuring""
    //% mutateText="Visible properties""
    export function objectDestructuringTest(cb: (a: SomeBagOfProperties) => void): void { }

    export class Anotherclass {
        //% blockId=test_class_defaultInstanceMethod
        //% block="default instance method with %a| and %b"
        //% defaultInstance=testNamespace.builtin
        public defaultInstanceMethod(a: number, b: number) {}
    }

    //% blockId=test_createDefInstanceClass
    //% block="Create default instance class"
    export function createDefInstanceClass(): Anotherclass { return new Anotherclass(); }

    export const builtin: Anotherclass = createDefInstanceClass();


    /**
     * Field Editors
     */

    //% blockId=test_sliderFieldEditor block="%value"
    //% value.min=0 value.max=500
    export function sliderFieldEditor(value: number): void {  }

    //% blockId=test_customFieldEditor block="%value=test_customShadowField"
    export function customFieldEditor(value: number): void {  }

    //% blockId=test_customFieldEditorWithMutation block="%value=test_customShadowField"
    //% value.shadowOptions.test=0
    export function customFieldEditorWithMutation(value: number): void { }

    //% blockId=test_customFieldEditorOnParentBlock block="%value"
    //% value.fieldEditor="note" value.fieldOptions.onParentBlock=true
    //% value.fieldOptions.decompileLiterals=true
    export function customFieldEditorOnParentBlock(value: number): void { }

    //% blockId=test_customTextFieldEditorOnParentBlock block="%text"
    //% text.fieldEditor="text" text.fieldOptions.onParentBlock=true
    //% text.fieldOptions.decompileLiterals=true
    export function customTextFieldEditorOnParentBlock(text: string): void { }

    //% blockId=test_customShadowField block="%value"
    //% value.fieldEditor="note" value.fieldOptions.decompileLiterals=true
    export function customShadowField(value: number): number { return value; }

    //% blockId=test_customShadowFieldNoLiterals block="%value"
    //% value.fieldEditor="note"
    export function customShadowFieldNoLiterals(value: number): number { return value; }

    //% blockId=test_customShadowFieldNoLiterals2 block="%value"
    //% value.fieldEditor="note"
    export function customShadowFieldNoLiterals2(value: string): string { return value; }

    //% blockId=test_customFieldEditorNoLiterals block="%value=test_customShadowFieldNoLiterals %value2=test_customShadowFieldNoLiterals2"
    export function customFieldEditorNoLiterals(value: number, value2: string): void {  }


    //% blockId=test_toStringArg block="to string %msg"
    //% msg.shadowOptions.toString=true
    export function toStringArg(msg: string) {

    }
}

//% color=#0078D7 weight=100
namespace actions {
    //% blockId="event_with_action"
    //% block="event with action $someNumber"
    export function eventWithAnAction(someNumber: number, arg: Action) {

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