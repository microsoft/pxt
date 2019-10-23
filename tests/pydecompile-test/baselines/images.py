#/ <reference path="./testBlocks/mb.ts" />

basic.showLeds("""
    . . . . .
    . # . # .
    . . . . .
    # . . . #
    . # # # .
""")

x = images.createImage("""
    . . . . .
    . # . # .
    . . . . .
    . # # # .
    # . . . #
""")

y = images.createBigImage("""
    . . . . .   . . . . .
    . # # # .   . # # # .
    . # . # .   . # . # .
    . # # # .   . # # # .
    . . . . .   . . . . .
""")