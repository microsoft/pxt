controller.anyButton.onEvent(ControllerButtonEvent.Pressed, (b: number) => {
    return true
})
controller.anyButton.onEvent(ControllerButtonEvent.Released, function some_callback(b: number) {
    return false
})

sprites.onOverlap(SpriteKind.Player, SpriteKind.Projectile, () => { });