function sprite_first () {
    for (let localSprite1 of testTypes.allSprites()) {
        localSprite1.setPosition(0, 0)
        return localSprite1
    }
    return testTypes.undefinedValue()
}
function undefined_first () {
    if (true) {
        return testTypes.undefinedValue()
    }
    for (let localSprite2 of testTypes.allSprites()) {
        localSprite2.setPosition(0, 0)
        return localSprite2
    }
}
let undefinedFirst: Sprite = null
let spriteFirst: Sprite = null
let spriteFirstReferenced = spriteFirst == spriteFirst
let undefinedFirstReferenced = undefinedFirst == undefinedFirst
spriteFirst = sprite_first()
undefinedFirst = undefined_first()
game.onUpdate(function () {
    spriteFirst = sprite_first()
    undefinedFirst = undefined_first()
})