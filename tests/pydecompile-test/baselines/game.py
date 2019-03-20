class Foo:
  def qux2(self):
    z = 12
    x = z * 3
    self.baz = x
  def qux(self):
    self.baz = self.bar
    self.blah = "hello"

class SpriteKind(Enum):
    Player = 0
    Projectile = 1
    Enemy = 2
    Food = 3

asteroids = [sprites.space.spaceSmallAsteroid1, sprites.space.spaceSmallAsteroid0, sprites.space.spaceAsteroid0, sprites.space.spaceAsteroid1, sprites.space.spaceAsteroid4, sprites.space.spaceAsteroid3]
ship = sprites.create(sprites.space.spaceRedShip, SpriteKind.Player)
ship.setFlag(SpriteFlag.StayInScreen, True)
ship.bottom = 120
controller.moveSprite(ship, 100, 100)
info.setLife(3)

def playerDamage(sprite:Sprite, otherSprite:Sprite):
    scene.cameraShake(4, 500)
    otherSprite.destroy(effects.disintegrate)
    if True:
      sprite.startEffect(effects.fire, 200)
      info.changeLifeBy(-1)
sprites.onOverlap(SpriteKind.Player, SpriteKind.Enemy, playerDamage)

def enemyDamage(sprite:Sprite, otherSprite:Sprite):
    sprite.destroy()
    otherSprite.destroy(effects.disintegrate)
    info.changeScoreBy(1)
sprites.onOverlap(SpriteKind.Projectile, SpriteKind.Enemy, enemyDamage)

def shoot():
    projectile = sprites.createProjectileFromSprite(sprites.food.smallApple, ship, 0, -140)
    projectile.startEffect(effects.coolRadial, 100) 
controller.A.onEvent(ControllerButtonEvent.Pressed, shoot)

def spawnEnemy():
    projectile = sprites.createProjectileFromSide(asteroids[Math.randomRange(0, asteroids.length - 1)], 0, 75)
    projectile.setKind(SpriteKind.Enemy)
    projectile.x = Math.randomRange(10, 150)
game.onUpdateInterval(500, spawnEnemy)
