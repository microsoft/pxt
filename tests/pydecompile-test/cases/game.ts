class Foo {
    baz: number
    bar: number
    blah: string
    public qux2() {
        let z = 12
        let x = z * 3
        this.baz = x
    }

    public qux() {
        this.baz = this.bar
        this.blah = "hello"
    }

}

class SpriteKind {
    static Player = 0
    static Projectile = 1
    static Enemy = 2
    static Food = 3
}

let asteroids = [sprites.space.spaceSmallAsteroid1, sprites.space.spaceSmallAsteroid0, sprites.space.spaceAsteroid0, sprites.space.spaceAsteroid1, sprites.space.spaceAsteroid4, sprites.space.spaceAsteroid3]
let ship = sprites.create(sprites.space.spaceRedShip, SpriteKind.Player)
ship.setFlag(SpriteFlag.StayInScreen, true)
ship.bottom = 120
controller.moveSprite(ship, 100, 100)
info.setLife(3)
function playerDamage(sprite: Sprite, otherSprite: Sprite) {
    scene.cameraShake(4, 500)
    otherSprite.destroy(effects.disintegrate)
    if (true) {
        sprite.startEffect(effects.fire, 200)
        info.changeLifeBy(-1)
    }

}

sprites.onOverlap(SpriteKind.Player, SpriteKind.Enemy, playerDamage)
function enemyDamage(sprite: Sprite, otherSprite: Sprite) {
    sprite.destroy()
    otherSprite.destroy(effects.disintegrate)
    info.changeScoreBy(1)
}

sprites.onOverlap(SpriteKind.Projectile, SpriteKind.Enemy, enemyDamage)
function shoot() {
    let projectile = sprites.createProjectileFromSprite(sprites.food.smallApple, ship, 0, -140)
    projectile.startEffect(effects.coolRadial, 100)
}

controller.A.onEvent(ControllerButtonEvent.Pressed, shoot)
function spawnEnemy() {
    let projectile = sprites.createProjectileFromSide(asteroids[Math.randomRange(0, asteroids.length - 1)], 0, 75)
    projectile.setKind(SpriteKind.Enemy)
    projectile.x = Math.randomRange(10, 150)
}

game.onUpdateInterval(500, spawnEnemy)
