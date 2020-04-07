#/ <reference path="./testBlocks/enums.ts" />

enum_var1 = MyEnum.Value2
enum_var2 = enumTest.enumShim(MyEnum.Value2)

def function_0():
  pass
enumTest.enumEvent(MyEnum.Value2, function_0)
def function_1():
  pass
enumTest.enumEvent(enumTest.enumShim(MyEnum.Value2), function_1)
enumTest.enumArg(MyEnum.Value2)
enumTest.enumShadowArg(MyEnum.Value2)