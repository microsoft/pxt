class Foo:
  def qux2(self):
    z = 12
    x = z * 3
    self.baz = x
    for q in range(10):
      x += q
    lst = ["foo", "bar", "baz"]
    lst = lst[1:2]
    assert len(lst) == 2, 201
  def qux(self):
    self.baz = self.bar
    self.blah = "hello"
    self._priv = 1
    self._prot = self.baz
  def _prot2(self):
    pass

class Bar(Foo):
  def something(self):
     super()._prot2()
  def something2(self):
     self._prot = 12

class SpriteKind(Enum):
    Player = 0
    Projectile = 1
    Enemy = 2
    Food = 3

ii = img("""
. . . .
. a . .
. b b .
""")
hbuf = hex("a007")
hbuf2 = b'\xB0\x07'
asteroids = [sprites.space.space_small_asteroid1, sprites.space.space_small_asteroid0, sprites.space.space_asteroid0, sprites.space.space_asteroid1, sprites.space.space_asteroid4, sprites.space.space_asteroid3]
ship = sprites.create(sprites.space.space_red_ship, SpriteKind.Player)
ship.set_flag(SpriteFlag.STAY_IN_SCREEN, True)
ship.bottom = 120
controller.move_sprite(ship, 100, 100)
info.set_life(3)

def player_damage(sprite, other_sprite):
    scene.camera_shake(4, 500)
    other_sprite.destroy(effects.disintegrate)
    sprite.start_effect(effects.fire, 200)
    info.change_life_by(-1)
sprites.on_overlap(SpriteKind.Player, SpriteKind.Enemy, player_damage)
if False:
  player_damage(ship, ship)

def enemy_damage(sprite:Sprite, other_sprite:Sprite):
    sprite.destroy()
    other_sprite.destroy(effects.disintegrate)
    info.change_score_by(1)
sprites.on_overlap(SpriteKind.Projectile, SpriteKind.Enemy, enemy_damage)

def shoot():
    projectile = sprites.create_projectile_from_sprite(sprites.food.small_apple, ship, 0, -140)
    projectile.start_effect(effects.cool_radial, 100) 
controller.A.on_event(ControllerButtonEvent.PRESSED, shoot)

def spawn_enemy():
    projectile = sprites.create_projectile_from_side(asteroids[math.random_range(0, asteroids.length - 1)], 0, 75)
    projectile.set_kind(SpriteKind.Enemy)
    projectile.x = math.random_range(10, 150)
game.on_update_interval(500, spawn_enemy)
