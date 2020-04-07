#/ <reference path="./testBlocks/expandableBlocks.ts" />

expandable.optionalParams("hello", 180, True, Direction.Right)
expandable.optionalParams("hi there", 180)

expandable.justOptional()
expandable.justOptional("how are you")

expandable.optionalSubset("i am fine", 180, True)
expandable.optionalSubset("that is good", 180, True, Direction.Right)