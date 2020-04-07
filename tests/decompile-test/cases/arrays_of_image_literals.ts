let mySprite: Image;

template.runImageAnimation(
    mySprite,
    [img`
        . . . . . . 9 9 9 9 . . . . . .
        . . . . 2 2 3 3 3 3 2 e . . . .
        . . . 2 3 d 1 1 d d 3 2 e . . .
        . . 2 3 1 d 3 3 3 d d 3 e . . .
        . 2 3 1 3 3 3 3 3 d 1 3 b e . .
        . 2 1 d 3 3 3 3 d 3 3 1 3 b b .
        2 3 1 d 3 3 1 1 3 3 3 1 3 4 b b
        2 d 3 3 d 1 3 1 3 3 3 1 3 4 4 b
        2 d 3 3 3 1 3 1 3 3 3 1 b 4 4 e
        2 d 3 3 3 1 1 3 3 3 3 1 b 4 4 e
        e d 3 3 3 3 d 3 3 3 d d b 4 4 e
        e d d 3 3 3 d 3 3 3 1 3 b 4 b e
        e 3 d 3 3 1 d d 3 d 1 b b e e .
        . e 3 1 1 d d 1 1 1 b b e e e .
        . . e 3 3 3 3 3 3 b e e e e . .
        . . . e e e e e e e e e e . . .
    `,img`
        . . . . . 3 3 b 3 3 d d 3 3 . .
        . . . . 3 1 1 d 3 d 1 1 1 1 3 .
        . . . 3 d 1 1 1 d 1 1 1 d 3 1 3
        . . 3 d d 1 1 1 d d 1 1 1 3 3 3
        . 3 1 1 d 1 1 1 1 d d 1 1 b . .
        . 3 1 1 1 d 1 1 1 1 1 d 1 1 3 .
        . b d 1 1 1 d 1 1 1 1 1 1 1 3 .
        . 4 b 1 1 1 1 d d 1 1 1 1 d 3 .
        . 4 4 d 1 1 1 1 1 1 d d d b b .
        . 4 d b d 1 1 1 1 1 1 1 1 3 . .
        4 d d 5 b d 1 1 1 1 1 1 1 3 . .
        4 5 d 5 5 b b d 1 1 1 1 d 3 . .
        4 5 5 d 5 5 d b b b d d 3 . . .
        4 5 5 5 d d d d 4 4 b 3 . . . .
        . 4 5 5 5 4 4 4 . . . . . . . .
        . . 4 4 4 . . . . . . . . . . .
    `,img`
        . . . . . . . . . . b 5 b . . .
        . . . . . . . . . b 5 b . . . .
        . . . . . . . . . b c . . . . .
        . . . . . . b b b b b b . . . .
        . . . . . b b 5 5 5 5 5 b . . .
        . . . . b b 5 d 1 f 5 5 d f . .
        . . . . b 5 5 1 f f 5 d 4 c . .
        . . . . b 5 5 d f b d d 4 4 . .
        b d d d b b d 5 5 5 4 4 4 4 4 b
        b b d 5 5 5 b 5 5 4 4 4 4 4 b .
        b d c 5 5 5 5 d 5 5 5 5 5 b . .
        c d d c d 5 5 b 5 5 5 5 5 5 b .
        c b d d c c b 5 5 5 5 5 5 5 b .
        . c d d d d d d 5 5 5 5 5 d b .
        . . c b d d d d d 5 5 5 b b . .
        . . . c c c c c c c c b b . . .
    `,img`
        . . . . . . . . . . b 5 b . . .
        . . . . . . . . . b 5 b . . . .
        . . . . . . b b b b b b . . . .
        . . . . . b b 5 5 5 5 5 b . . .
        . . . . b b 5 d 1 f 5 d 4 c . .
        . . . . b 5 5 1 f f d d 4 4 4 b
        . . . . b 5 5 d f b 4 4 4 4 b .
        . . . b d 5 5 5 5 4 4 4 4 b . .
        . . b d d 5 5 5 5 5 5 5 5 b . .
        . b d d d d 5 5 5 5 5 5 5 5 b .
        b d d d b b b 5 5 5 5 5 5 5 b .
        c d d b 5 5 d c 5 5 5 5 5 5 b .
        c b b d 5 d c d 5 5 5 5 5 5 b .
        . b 5 5 b c d d 5 5 5 5 5 d b .
        b b c c c d d d d 5 5 5 b b . .
        . . . c c c c c c c c b b . . .
    `],
    200,
    true
)