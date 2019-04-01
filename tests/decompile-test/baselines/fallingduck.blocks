enum SpriteKind {
    Player,
    Projectile,
    Food,
    Enemy
}
enum ActionKind {
    Walking,
    Idle,
    Jumping
}
controller.anyButton.onEvent(ControllerButtonEvent.Pressed, function () {
    mySprite.vy = -100
    animation.setAction(mySprite, ActionKind.Jumping)
    mySprite.startEffect(effects.rings, 300)
})
sprites.onOverlap(SpriteKind.Player, SpriteKind.Projectile, function (sprite, otherSprite) {
    game.over()
})
let projectile: Sprite = null
let bottomImage: Image = null
let topImage: Image = null
let gap = 0
let mySprite: Sprite = null
scene.setBackgroundColor(9)
effects.blizzard.startScreenEffect()
mySprite = sprites.create(img`
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
`, SpriteKind.Player)
mySprite.ay = 300
let anim = animation.createAnimation(ActionKind.Jumping, 25)
anim.addAnimationFrame(img`
    . . . . . . . . . . . . . . . .
    . . . . . . . . . . . . . . . .
    . . . . . . . . . b 5 5 b . . .
    . . . . . . b b b b b b . . . .
    . . . . . b b 5 5 5 5 5 b . . .
    . b b b b b 5 5 5 5 5 5 5 b . .
    . b d 5 b 5 5 5 5 5 5 5 5 b . .
    . . b 5 5 b 5 d 1 f 5 d 4 f . .
    . . b d 5 5 b 1 f f 5 4 4 c . .
    b b d b 5 5 5 d f b 4 4 4 4 b .
    b d d c d 5 5 b 5 4 4 4 4 4 4 b
    c d d d c c b 5 5 5 5 5 5 5 b .
    c b d d d d d 5 5 5 5 5 5 5 b .
    . c d d d d d d 5 5 5 5 5 d b .
    . . c b d d d d d 5 5 5 b b . .
    . . . c c c c c c c c b b . . .
`)
anim.addAnimationFrame(img`
    . . . . . . . . . . . . . . . .
    . . . . . . . . . . b 5 b . . .
    . . . . . . . . . b 5 b . . . .
    . . . . . . b b b b b b . . . .
    . . . . . b b 5 5 5 5 5 b . . .
    . b b b b b 5 5 5 5 5 5 5 b . .
    . b d 5 b 5 5 5 5 5 5 5 5 b . .
    . . b 5 5 b 5 d 1 f 5 d 4 f . .
    . . b d 5 5 b 1 f f 5 4 4 c . .
    b b d b 5 5 5 d f b 4 4 4 4 4 b
    b d d c d 5 5 b 5 4 4 4 4 4 b .
    c d d d c c b 5 5 5 5 5 5 5 b .
    c b d d d d d 5 5 5 5 5 5 5 b .
    . c d d d d d d 5 5 5 5 5 d b .
    . . c b d d d d d 5 5 5 b b . .
    . . . c c c c c c c c b b . . .
`)
anim.addAnimationFrame(img`
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
`)
anim.addAnimationFrame(img`
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
`)
anim.addAnimationFrame(img`
    . . . . . . . . . . b 5 b . . .
    . . . . . . . . . b 5 b . . . .
    . . . . . . b b b b b b . . . .
    . . . . . b b 5 5 5 5 5 b . . .
    . . . . b b 5 d 1 f 5 d 4 c . .
    . . . . b 5 5 1 f f d d 4 4 4 b
    . . . . b 5 5 d f b 4 4 4 4 b .
    . . . b d 5 5 5 5 4 4 4 4 b . .
    . b b d d d 5 5 5 5 5 5 5 b . .
    b d d d b b b 5 5 5 5 5 5 5 b .
    c d d b 5 5 d c 5 5 5 5 5 5 b .
    c b b d 5 d c d 5 5 5 5 5 5 b .
    c b 5 5 b c d d 5 5 5 5 5 5 b .
    b b c c c d d d 5 5 5 5 5 d b .
    . . . . c c d d d 5 5 5 b b . .
    . . . . . . c c c c c b b . . .
`)
anim.addAnimationFrame(img`
    . . . . . . . . . . b 5 b . . .
    . . . . . . . . . b 5 b . . . .
    . . . . . . b b b b b b . . . .
    . . . . . b b 5 5 5 5 5 b . . .
    . . . . b b 5 d 1 f 5 5 d f . .
    . . . . b 5 5 1 f f 5 d 4 c . .
    . . . . b 5 5 d f b d d 4 4 . .
    . b b b d 5 5 5 5 5 4 4 4 4 4 b
    b d d d b b d 5 5 4 4 4 4 4 b .
    b b d 5 5 5 b 5 5 5 5 5 5 b . .
    c d c 5 5 5 5 d 5 5 5 5 5 5 b .
    c b d c d 5 5 b 5 5 5 5 5 5 b .
    . c d d c c b d 5 5 5 5 5 d b .
    . . c b d d d d d 5 5 5 b b . .
    . . . c c c c c c c c b b . . .
    . . . . . . . . . . . . . . . .
`)
animation.attachAnimation(mySprite, anim)
game.onUpdateInterval(1500, function () {
    info.changeScoreBy(1)
    gap = Math.randomRange(0, 3)
    if (gap == 0) {
        topImage = img`
            . . . . . 6 e e e e e e e e e e c e 6 . . . . .
            . . . . 6 7 7 6 e e e e e e e e e 6 7 6 . . . .
            . . . 6 7 7 6 6 6 6 e e e e 6 7 6 6 7 7 6 . . .
            . . 6 7 7 6 e e 7 7 7 7 7 7 7 7 6 6 7 7 7 6 . .
            . . . 6 6 8 c e 7 7 6 8 8 6 7 7 8 8 6 6 6 . . .
            . . . . . . c e 7 7 e e e e 6 7 e e . . . . . .
            . . . . . . e e e e e e e e e e e e . . . . . .
            . . . . . . e e e e e e e e e e e e . . . . . .
            . . . . . . e e e e e e e e e e e e . . . . . .
            . . . . . . e e e e e e e e e e e e . . . . . .
            . . . . . . e e e e e e e e e e e e . . . . . .
            . . . . . . e e e e e e e e e e e e . . . . . .
            . . . . . . e e e e e e e e e e e e . . . . . .
            . . . . . . b e e e e e e e e e e b . . . . . .
            . . . . . . . b e e e e e e e e b . . . . . . .
            . . . . . . . . b e e e e e e b . . . . . . . .
        `
        bottomImage = img`
            . . . . . . . . . . . . . . . . . . . . . . . .
            . . . . . . . . . . . . . . . . . . . . . . . .
            . . . . . . . . . . b b b b . . . . . . . . . .
            . . . . . . . . b b d d d d b b . . . . . . . .
            . . . . . . . b d d b b b b d d b . . . . . . .
            . . . . . . b d b b d d d d b b d b . . . . . .
            . . . . . b d b b d b b b b d b b d b . . . . .
            . . . . . b d b d b d d d d b d b d b . . . . .
            . . . . . c d b b d b b b b d b b d c . . . . .
            . . . . . c b d b b d d d d b b d b c . . . . .
            . . . . . e f b d d b b b b d d b c e . . . . .
            . . . . . e e f f b d d d d b c c e e . . . . .
            . . . . . e e e e f f c c c c e e e . . . . . .
            . . . . . c e e e e e e e e e e e e . . . . . .
            . . . . . c e e e e e e e e e e e e . . . . . .
            . . . . . f e e e e e e e e e e e e . . . . . .
            . . . . . c c e e e e e e e e e e e . . . . . .
            . . . . . . f e e e e e e e e e e e . . . . . .
            . . . . . 6 f c e e e e e e e e e e 6 . . . . .
            . . . . 6 7 7 6 e e e e e e e e e 6 7 6 . . . .
            . . . 6 7 7 7 6 6 6 e e e e 6 6 6 6 7 7 6 . . .
            . . 6 7 7 6 8 e 6 7 7 6 6 7 7 7 6 6 7 7 7 6 . .
            . . . 6 6 8 e e 7 7 6 8 8 6 7 7 8 8 6 6 6 . . .
            . . . . . . e e 7 7 e e e e 7 7 e c e e . . . .
            . . . . . . e e 6 e e e e e e 6 e e f . . . . .
            . . . . . . e e e e e e e e e e e e f . . . . .
            . . . . . . e e e e e e e e e e e e f . . . . .
            . . . . . . e e e e e e e e e e e c f . . . . .
            . . . . . . c e e e e e e e e e e c f . . . . .
            . . . . . . c e e e e e e e e e e f f . . . . .
            . . . . . . f e e e e e e e e e e f e . . . . .
            . . . . . 6 f e e e e e e e e e e f 6 . . . . .
            . . . . 6 7 7 6 e e e e e e e e e 6 7 6 . . . .
            . . . 6 7 7 7 6 6 6 e e e e 6 6 6 7 7 7 6 . . .
            . . 6 7 7 6 e e 6 7 7 7 7 7 7 7 6 6 7 7 7 6 . .
            . . . 6 6 8 e e 7 7 6 8 8 6 7 7 8 8 6 6 6 . . .
            . . . . . . e e 7 7 e e e e 6 7 e e . . . . . .
            . . . . . . e e 6 e e e e e e 6 c e . . . . . .
            . . . . . . e e f e e e e e e e c e . . . . . .
            . . . . . . e e c e e e e e e e c e . . . . . .
            . . . . . . e e c e e e e e e e f e . . . . . .
            . . . . . . e e c e e e e e e e f e . . . . . .
            . . . . . . e e e e e e e e e e f e . . . . . .
            . . . . . . e e e e e e e e e e c e . . . . . .
            . . . . . 6 e e e e e e e e e e c e 6 . . . . .
            . . . . 6 7 7 6 e e e e e e e e e 6 7 6 . . . .
            . . . 6 7 7 6 6 6 6 e e e e 6 7 6 6 7 7 6 . . .
            . . 6 7 7 6 e e 7 7 7 7 7 7 7 7 6 6 7 7 7 6 . .
            . . . 6 6 8 c e 7 7 6 8 8 6 7 7 8 8 6 6 6 . . .
            . . . . . . c e 7 7 e e e e 6 7 e e . . . . . .
            . . . . . . c e 6 e e e e e e 6 e e . . . . . .
            . . . . . . c e e e e e e e e e e e . . . . . .
            . . . . . . f c c e e e e e e c e e . . . . . .
            . . . . . . f c c c e e e c e c c e . . . . . .
            . . . . . . f c c e e e c c e c c c . . . . . .
            . . . . . . f c c c e e c c e c c c . . . . . .
            . . . . . . f c c c c c e c e e c c . . . . . .
            . . . . . 6 f c c c c c c c c c c f 6 . . . . .
            . . . . 6 7 7 6 c c c c c c c c c 6 7 6 . . . .
            . . . 6 7 7 6 6 7 6 c c c c 6 7 6 6 7 7 6 . . .
            . . 6 7 7 6 c c 7 7 7 7 7 7 7 7 6 6 7 7 7 6 . .
            . . . 6 6 8 c c 7 7 6 8 8 6 7 7 8 8 6 6 6 . . .
            . . . . . . c c 7 7 c c c c 6 7 c f . . . . . .
            . . . . . . c c 6 c c c c c c 6 c f . . . . . .
        `
    } else if (gap == 1) {
        topImage = img`
            . . . . . 6 f e e e e e e e e e e f 6 . . . . .
            . . . . 6 7 7 6 e e e e e e e e e 6 7 6 . . . .
            . . . 6 7 7 7 6 6 6 e e e e 6 6 6 7 7 7 6 . . .
            . . 6 7 7 6 e e 6 7 7 7 7 7 7 7 6 6 7 7 7 6 . .
            . . . 6 6 8 e e 7 7 6 8 8 6 7 7 8 8 6 6 6 . . .
            . . . . . . e e 7 7 e e e e 6 7 e e . . . . . .
            . . . . . . e e 6 e e e e e e 6 c e . . . . . .
            . . . . . . e e f e e e e e e e c e . . . . . .
            . . . . . . e e c e e e e e e e c e . . . . . .
            . . . . . . e e c e e e e e e e f e . . . . . .
            . . . . . . e e c e e e e e e e f e . . . . . .
            . . . . . . e e e e e e e e e e f e . . . . . .
            . . . . . . e e e e e e e e e e c e . . . . . .
            . . . . . 6 e e e e e e e e e e c e 6 . . . . .
            . . . . 6 7 7 6 e e e e e e e e e 6 7 6 . . . .
            . . . 6 7 7 6 6 6 6 e e e e 6 7 6 6 7 7 6 . . .
            . . 6 7 7 6 e e 7 7 7 7 7 7 7 7 6 6 7 7 7 6 . .
            . . . 6 6 8 c e 7 7 6 8 8 6 7 7 8 8 6 6 6 . . .
            . . . . . . c e 7 7 e e e e 6 7 e e . . . . . .
            . . . . . . e e e e e e e e e e e e . . . . . .
            . . . . . . e e e e e e e e e e e e . . . . . .
            . . . . . . e e e e e e e e e e e e . . . . . .
            . . . . . . e e e e e e e e e e e e . . . . . .
            . . . . . . e e e e e e e e e e e e . . . . . .
            . . . . . . e e e e e e e e e e e e . . . . . .
            . . . . . . e e e e e e e e e e e e . . . . . .
            . . . . . . b e e e e e e e e e e b . . . . . .
            . . . . . . . b e e e e e e e e b . . . . . . .
            . . . . . . . . b e e e e e e b . . . . . . . .
            . . . . . . . . . . . . . . . . . . . . . . . .
            . . . . . . . . . . . . . . . . . . . . . . . .
            . . . . . . . . . . . . . . . . . . . . . . . .
        `
        bottomImage = img`
            . . . . . . . . . . . . . . . . . . . . . . . .
            . . . . . . . . . . . . . . . . . . . . . . . .
            . . . . . . . . . . . . . . . . . . . . . . . .
            . . . . . . . . . . . . . . . . . . . . . . . .
            . . . . . . . . . . . . . . . . . . . . . . . .
            . . . . . . . . . . . . . . . . . . . . . . . .
            . . . . . . . . . . . . . . . . . . . . . . . .
            . . . . . . . . . . b b b b . . . . . . . . . .
            . . . . . . . . b b d d d d b b . . . . . . . .
            . . . . . . . b d d b b b b d d b . . . . . . .
            . . . . . . b d b b d d d d b b d b . . . . . .
            . . . . . b d b b d b b b b d b b d b . . . . .
            . . . . . b d b d b d d d d b d b d b . . . . .
            . . . . . c d b b d b b b b d b b d c . . . . .
            . . . . . c b d b b d d d d b b d b c . . . . .
            . . . . . e f b d d b b b b d d b c e . . . . .
            . . . . . e e f f b d d d d b c c e e . . . . .
            . . . . . e e e e f f c c c c e e e . . . . . .
            . . . . . c e e e e e e e e e e e e . . . . . .
            . . . . . c e e e e e e e e e e e e . . . . . .
            . . . . . f e e e e e e e e e e e e . . . . . .
            . . . . . c c e e e e e e e e e e e . . . . . .
            . . . . . . f e e e e e e e e e e e . . . . . .
            . . . . . 6 f c e e e e e e e e e e 6 . . . . .
            . . . . 6 7 7 6 e e e e e e e e e 6 7 6 . . . .
            . . . 6 7 7 7 6 6 6 e e e e 6 6 6 6 7 7 6 . . .
            . . 6 7 7 6 8 e 6 7 7 6 6 7 7 7 6 6 7 7 7 6 . .
            . . . 6 6 8 e e 7 7 6 8 8 6 7 7 8 8 6 6 6 . . .
            . . . . . . e e 7 7 e e e e 7 7 e c e e . . . .
            . . . . . . e e 6 e e e e e e 6 e e f . . . . .
            . . . . . . e e e e e e e e e e e e f . . . . .
            . . . . . . e e e e e e e e e e e e f . . . . .
            . . . . . . e e e e e e e e e e e c f . . . . .
            . . . . . . c e e e e e e e e e e c f . . . . .
            . . . . . . c e e e e e e e e e e f f . . . . .
            . . . . . . f e e e e e e e e e e f e . . . . .
            . . . . . 6 f e e e e e e e e e e f 6 . . . . .
            . . . . 6 7 7 6 e e e e e e e e e 6 7 6 . . . .
            . . . 6 7 7 7 6 6 6 e e e e 6 6 6 7 7 7 6 . . .
            . . 6 7 7 6 e e 6 7 7 7 7 7 7 7 6 6 7 7 7 6 . .
            . . . 6 6 8 e e 7 7 6 8 8 6 7 7 8 8 6 6 6 . . .
            . . . . . . e e 7 7 e e e e 6 7 e e . . . . . .
            . . . . . . e e 6 e e e e e e 6 c e . . . . . .
            . . . . . . e e f e e e e e e e c e . . . . . .
            . . . . . . e e c e e e e e e e c e . . . . . .
            . . . . . . e e c e e e e e e e f e . . . . . .
            . . . . . . e e c e e e e e e e f e . . . . . .
            . . . . . . e e e e e e e e e e f e . . . . . .
            . . . . . . e e e e e e e e e e c e . . . . . .
            . . . . . 6 e e e e e e e e e e c e 6 . . . . .
            . . . . 6 7 7 6 e e e e e e e e e 6 7 6 . . . .
            . . . 6 7 7 6 6 6 6 e e e e 6 7 6 6 7 7 6 . . .
            . . 6 7 7 6 e e 7 7 7 7 7 7 7 7 6 6 7 7 7 6 . .
            . . . 6 6 8 c e 7 7 6 8 8 6 7 7 8 8 6 6 6 . . .
            . . . . . . c e 7 7 e e e e 6 7 e e . . . . . .
            . . . . . . c e 6 e e e e e e 6 e e . . . . . .
        `
    } else if (gap == 2) {
        topImage = img`
            . . . . . 6 f e e e e e e e e e e f 6 . . . . .
            . . . . 6 7 7 6 e e e e e e e e e 6 7 6 . . . .
            . . . 6 7 7 7 6 6 6 e e e e 6 6 6 7 7 7 6 . . .
            . . 6 7 7 6 e e 6 7 7 7 7 7 7 7 6 6 7 7 7 6 . .
            . . . 6 6 8 e e 7 7 6 8 8 6 7 7 8 8 6 6 6 . . .
            . . . . . . e e 7 7 e e e e 6 7 e e e e . . . .
            . . . . . . e e 6 e e e e e e 6 c e f . . . . .
            . . . . . . e e e e e e e e e e e e f . . . . .
            . . . . . . e e e e e e e e e e e e f . . . . .
            . . . . . . e e e e e e e e e e e c f . . . . .
            . . . . . . e e e e e e e e e e e c f . . . . .
            . . . . . . e e e e e e e e e e e f f . . . . .
            . . . . . . f e e e e e e e e e e f e . . . . .
            . . . . . 6 f e e e e e e e e e e f 6 . . . . .
            . . . . 6 7 7 6 e e e e e e e e e 6 7 6 . . . .
            . . . 6 7 7 7 6 6 6 e e e e 6 6 6 7 7 7 6 . . .
            . . 6 7 7 6 e e 6 7 7 7 7 7 7 7 6 6 7 7 7 6 . .
            . . . 6 6 8 e e 7 7 6 8 8 6 7 7 8 8 6 6 6 . . .
            . . . . . . e e 7 7 e e e e 6 7 e e . . . . . .
            . . . . . . e e 6 e e e e e e 6 c e . . . . . .
            . . . . . . e e f e e e e e e e c e . . . . . .
            . . . . . . e e c e e e e e e e c e . . . . . .
            . . . . . . e e c e e e e e e e f e . . . . . .
            . . . . . . e e c e e e e e e e f e . . . . . .
            . . . . . . e e e e e e e e e e f e . . . . . .
            . . . . . . e e e e e e e e e e c e . . . . . .
            . . . . . 6 e e e e e e e e e e c e 6 . . . . .
            . . . . 6 7 7 6 e e e e e e e e e 6 7 6 . . . .
            . . . 6 7 7 6 6 6 6 e e e e 6 7 6 6 7 7 6 . . .
            . . 6 7 7 6 e e 7 7 7 7 7 7 7 7 6 6 7 7 7 6 . .
            . . . 6 6 8 c e 7 7 6 8 8 6 7 7 8 8 6 6 6 . . .
            . . . . . . c e 7 7 e e e e 6 7 e e . . . . . .
            . . . . . . e e e e e e e e e e e e . . . . . .
            . . . . . . e e e e e e e e e e e e . . . . . .
            . . . . . . e e e e e e e e e e e e . . . . . .
            . . . . . . e e e e e e e e e e e e . . . . . .
            . . . . . . e e e e e e e e e e e e . . . . . .
            . . . . . . e e e e e e e e e e e e . . . . . .
            . . . . . . e e e e e e e e e e e e . . . . . .
            . . . . . . b e e e e e e e e e e b . . . . . .
            . . . . . . . b e e e e e e e e b . . . . . . .
            . . . . . . . . b e e e e e e b . . . . . . . .
            . . . . . . . . . . . . . . . . . . . . . . . .
            . . . . . . . . . . . . . . . . . . . . . . . .
            . . . . . . . . . . . . . . . . . . . . . . . .
            . . . . . . . . . . . . . . . . . . . . . . . .
            . . . . . . . . . . . . . . . . . . . . . . . .
            . . . . . . . . . . . . . . . . . . . . . . . .
        `
        bottomImage = img`
            . . . . . . . . . . . . . . . . . . . . . . . .
            . . . . . . . . . . . . . . . . . . . . . . . .
            . . . . . . . . . . . . . . . . . . . . . . . .
            . . . . . . . . . . . . . . . . . . . . . . . .
            . . . . . . . . . . b b b b . . . . . . . . . .
            . . . . . . . . b b d d d d b b . . . . . . . .
            . . . . . . . b d d b b b b d d b . . . . . . .
            . . . . . . b d b b d d d d b b d b . . . . . .
            . . . . . b d b b d b b b b d b b d b . . . . .
            . . . . . b d b d b d d d d b d b d b . . . . .
            . . . . . c d b b d b b b b d b b d c . . . . .
            . . . . . c b d b b d d d d b b d b c . . . . .
            . . . . . e f b d d b b b b d d b c e . . . . .
            . . . . . e e f f b d d d d b c c e e . . . . .
            . . . . . e e e e f f c c c c e e e . . . . . .
            . . . . . c e e e e e e e e e e e e . . . . . .
            . . . . . c e e e e e e e e e e e e . . . . . .
            . . . . . f e e e e e e e e e e e e . . . . . .
            . . . . . c c e e e e e e e e e e e . . . . . .
            . . . . . . f e e e e e e e e e e e . . . . . .
            . . . . . 6 f c e e e e e e e e e e 6 . . . . .
            . . . . 6 7 7 6 e e e e e e e e e 6 7 6 . . . .
            . . . 6 7 7 7 6 6 6 e e e e 6 6 6 6 7 7 6 . . .
            . . 6 7 7 6 8 e 6 7 7 6 6 7 7 7 6 6 7 7 7 6 . .
            . . . 6 6 8 e e 7 7 6 8 8 6 7 7 8 8 6 6 6 . . .
            . . . . . . e e 7 7 e e e e 7 7 e c e e . . . .
            . . . . . . e e 6 e e e e e e 6 e e f . . . . .
            . . . . . . e e e e e e e e e e e e f . . . . .
            . . . . . . e e e e e e e e e e e e f . . . . .
            . . . . . . e e e e e e e e e e e c f . . . . .
            . . . . . . c e e e e e e e e e e c f . . . . .
            . . . . . . c e e e e e e e e e e f f . . . . .
            . . . . . . f e e e e e e e e e e f e . . . . .
            . . . . . 6 f e e e e e e e e e e f 6 . . . . .
            . . . . 6 7 7 6 e e e e e e e e e 6 7 6 . . . .
            . . . 6 7 7 7 6 6 6 e e e e 6 6 6 7 7 7 6 . . .
            . . 6 7 7 6 e e 6 7 7 7 7 7 7 7 6 6 7 7 7 6 . .
            . . . 6 6 8 e e 7 7 6 8 8 6 7 7 8 8 6 6 6 . . .
            . . . . . . e e 7 7 e e e e 6 7 e e . . . . . .
            . . . . . . e e 6 e e e e e e 6 c e . . . . . .
        `
    } else {
        topImage = img`
            . . . . . 6 f c e e e e e e e e e e 6 . . . . .
            . . . . 6 7 7 6 e e e e e e e e e 6 7 6 . . . .
            . . . 6 7 7 7 6 6 6 e e e e 6 6 6 6 7 7 6 . . .
            . . 6 7 7 6 8 e 6 7 7 6 6 7 7 7 6 6 7 7 7 6 . .
            . . . 6 6 8 e e 7 7 6 8 8 6 7 7 8 8 6 6 6 . . .
            . . . . . . e e 7 7 e e e e 7 7 e c e e . . . .
            . . . . . . e e 6 e e e e e e 6 e e f . . . . .
            . . . . . . e e e e e e e e e e e e f . . . . .
            . . . . . . e e e e e e e e e e e e f . . . . .
            . . . . . . e e e e e e e e e e e c f . . . . .
            . . . . . . c e e e e e e e e e e c f . . . . .
            . . . . . . c e e e e e e e e e e f f . . . . .
            . . . . . . f e e e e e e e e e e f e . . . . .
            . . . . . 6 f e e e e e e e e e e f 6 . . . . .
            . . . . 6 7 7 6 e e e e e e e e e 6 7 6 . . . .
            . . . 6 7 7 7 6 6 6 e e e e 6 6 6 7 7 7 6 . . .
            . . 6 7 7 6 e e 6 7 7 7 7 7 7 7 6 6 7 7 7 6 . .
            . . . 6 6 8 e e 7 7 6 8 8 6 7 7 8 8 6 6 6 . . .
            . . . . . . e e 7 7 e e e e 6 7 e e e e . . . .
            . . . . . . e e 6 e e e e e e 6 c e f . . . . .
            . . . . . . e e e e e e e e e e e e f . . . . .
            . . . . . . e e e e e e e e e e e e f . . . . .
            . . . . . . e e e e e e e e e e e c f . . . . .
            . . . . . . e e e e e e e e e e e c f . . . . .
            . . . . . . e e e e e e e e e e e f f . . . . .
            . . . . . . f e e e e e e e e e e f e . . . . .
            . . . . . 6 f e e e e e e e e e e f 6 . . . . .
            . . . . 6 7 7 6 e e e e e e e e e 6 7 6 . . . .
            . . . 6 7 7 7 6 6 6 e e e e 6 6 6 7 7 7 6 . . .
            . . 6 7 7 6 e e 6 7 7 7 7 7 7 7 6 6 7 7 7 6 . .
            . . . 6 6 8 e e 7 7 6 8 8 6 7 7 8 8 6 6 6 . . .
            . . . . . . e e 7 7 e e e e 6 7 e e . . . . . .
            . . . . . . e e 6 e e e e e e 6 c e . . . . . .
            . . . . . . e e f e e e e e e e c e . . . . . .
            . . . . . . e e c e e e e e e e c e . . . . . .
            . . . . . . e e c e e e e e e e f e . . . . . .
            . . . . . . e e c e e e e e e e f e . . . . . .
            . . . . . . e e e e e e e e e e f e . . . . . .
            . . . . . . e e e e e e e e e e c e . . . . . .
            . . . . . 6 e e e e e e e e e e c e 6 . . . . .
            . . . . 6 7 7 6 e e e e e e e e e 6 7 6 . . . .
            . . . 6 7 7 6 6 6 6 e e e e 6 7 6 6 7 7 6 . . .
            . . 6 7 7 6 e e 7 7 7 7 7 7 7 7 6 6 7 7 7 6 . .
            . . . 6 6 8 c e 7 7 6 8 8 6 7 7 8 8 6 6 6 . . .
            . . . . . . c e 7 7 e e e e 6 7 e e . . . . . .
            . . . . . . e e e e e e e e e e e e . . . . . .
            . . . . . . e e e e e e e e e e e e . . . . . .
            . . . . . . e e e e e e e e e e e e . . . . . .
            . . . . . . e e e e e e e e e e e e . . . . . .
            . . . . . . e e e e e e e e e e e e . . . . . .
            . . . . . . e e e e e e e e e e e e . . . . . .
            . . . . . . e e e e e e e e e e e e . . . . . .
            . . . . . . b e e e e e e e e e e b . . . . . .
            . . . . . . . b e e e e e e e e b . . . . . . .
            . . . . . . . . b e e e e e e b . . . . . . . .
            . . . . . . . . . . . . . . . . . . . . . . . .
        `
        bottomImage = img`
            . . . . . . . . . . . . . . . . . . . . . . . .
            . . . . . . . . . . b b b b . . . . . . . . . .
            . . . . . . . . b b d d d d b b . . . . . . . .
            . . . . . . . b d d b b b b d d b . . . . . . .
            . . . . . . b d b b d d d d b b d b . . . . . .
            . . . . . b d b b d b b b b d b b d b . . . . .
            . . . . . b d b d b d d d d b d b d b . . . . .
            . . . . . c d b b d b b b b d b b d c . . . . .
            . . . . . c b d b b d d d d b b d b c . . . . .
            . . . . . e f b d d b b b b d d b c e . . . . .
            . . . . . e e f f b d d d d b c c e e . . . . .
            . . . . . e e e e f f c c c c e e e . . . . . .
            . . . . . c e e e e e e e e e e e e . . . . . .
            . . . . . c e e e e e e e e e e e e . . . . . .
            . . . . . f e e e e e e e e e e e e . . . . . .
            . . . . . c c e e e e e e e e e e e . . . . . .
            . . . . . . f e e e e e e e e e e e . . . . . .
            . . . . . 6 f c e e e e e e e e e e 6 . . . . .
            . . . . 6 7 7 6 e e e e e e e e e 6 7 6 . . . .
            . . . 6 7 7 7 6 6 6 e e e e 6 6 6 6 7 7 6 . . .
            . . 6 7 7 6 8 e 6 7 7 6 6 7 7 7 6 6 7 7 7 6 . .
            . . . 6 6 8 e e 7 7 6 8 8 6 7 7 8 8 6 6 6 . . .
            . . . . . . e e 7 7 e e e e 7 7 e c e e . . . .
            . . . . . . e e 6 e e e e e e 6 e e f . . . . .
        `
    }
    projectile = sprites.createProjectileFromSide(topImage, -45, 0)
    projectile.top = 0
    projectile = sprites.createProjectileFromSide(bottomImage, -45, 0)
    projectile.bottom = scene.screenHeight()
})
game.onUpdate(function () {
    if (mySprite.vy > 0) {
        animation.setAction(mySprite, ActionKind.Idle)
    }
    if (mySprite.bottom > 120 || mySprite.top < 0) {
        game.over()
    }
})
