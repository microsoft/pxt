/// <reference path="./testBlocks/enums.ts" />

let enum_var1 = MyEnum.Value2;
let enum_var2 = enumTest.enumShim(MyEnum.Value2);

enumTest.enumEvent(MyEnum.Value2, function() {

});
enumTest.enumEvent(enumTest.enumShim(MyEnum.Value2), function() {

});
enumTest.enumArg(MyEnum.Value2);
enumTest.enumShadowArg(MyEnum.Value2);