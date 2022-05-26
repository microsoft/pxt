let statusbar: StatusBarSprite = null
statusbar.setPosition(7, 0)
statusbar = statusbars.create(20, 4, StatusBarKind.Health)
game.onUpdate(function () {
    statusbar.value = 0
})
