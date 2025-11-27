# إنشاء لاعب
player = sprites.create(img("""
    . . . . 2 2 2 2 . . . .
    . . . 2 2 2 2 2 2 . . .
    . . 2 2 2 2 2 2 2 2 . .
    . . 2 2 5 5 5 5 2 2 . .
    . 2 2 5 5 5 5 5 5 2 2 .
    . 2 2 5 5 2 2 5 5 2 2 .
    . 2 2 5 2 2 2 2 5 2 2 .
    . 2 2 2 2 2 2 2 2 2 2 .
    . . 2 2 2 2 2 2 2 2 . .
    . . . 2 2 2 2 2 2 . . .
    . . . . 2 2 2 2 . . . .
    . . . . . 2 2 . . . . .
"""), SpriteKind.player)
controller.move_sprite(player)
info.set_life(3)
scene.set_background_color(9)

# توليد نجوم (نقاط)
def spawn_star():
    star = sprites.create(img("""
        . . . . . . . . . . . .
        . . . . . 4 4 . . . . .
        . . . . 4 4 4 4 . . . .
        . . . 4 4 4 4 4 4 . . .
        . . 4 4 4 4 4 4 4 4 . .
        . . . 4 4 4 4 4 4 . . .
        . . . . 4 4 4 4 . . . .
        . . . . . 4 4 . . . . .
        . . . . . . . . . . . .
    """), SpriteKind.food)
    star.set_position(randint(10, 150), randint(10, 110))
game.on_update_interval(1500, spawn_star)

# توليد أعداء
def spawn_enemy():
    enemy = sprites.create(img("""
        . . . . 1 1 1 1 . . . .
        . . . 1 1 1 1 1 1 . . .
        . . 1 1 1 1 1 1 1 1 . .
        . . 1 1 1 1 1 1 1 1 . .
        . . . 1 1 1 1 1 1 . . .
        . . . . 1 1 1 1 . . . .
        . . . . . 1 1 . . . . .
    """), SpriteKind.enemy)
    enemy.set_position(randint(20, 140), 0)
    enemy.vy = randint(30, 60)
game.on_update_interval(1200, spawn_enemy)

# جمع النجوم
def on_overlap_star(player2, star2):
    info.change_score_by(1)
    star2.destroy()
sprites.on_overlap(SpriteKind.player, SpriteKind.food, on_overlap_star)

# التصادم مع الأعداء
def on_overlap_enemy(player2, enemy2):
    info.change_life_by(-1)
    enemy2.destroy()
sprites.on_overlap(SpriteKind.player, SpriteKind.enemy, on_overlap_enemy)
