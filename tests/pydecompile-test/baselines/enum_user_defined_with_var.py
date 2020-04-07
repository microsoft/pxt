#/ <reference path="./testBlocks/enums.ts" />

varEnumTest = 0

class PlainOldEnum(Enum):
  A = 0
  B = 1
  C = 2

varEnumTest = PlainOldEnum.A