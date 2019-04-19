// e.g.: controller.anyButton.onEvent(ControllerButtonEvent.Pressed, handler)
enum ControllerButtonEvent {
    Pressed,
    Released
}
class Button {
    public onEvent(eventType: ControllerButtonEvent, callback: (a: number, b: number) => boolean) {
        console.log(callback(3, 5) ? "t" : "f")
    }
}
class Controller {
    anyButton: Button
    constructor() {
        this.anyButton = new Button()
    }
}

let controller: Controller = new Controller()
controller.anyButton.onEvent(ControllerButtonEvent.Pressed, (b: number) => {
    return true
})
controller.anyButton.onEvent(ControllerButtonEvent.Released, function some_callback(b: number) {
    return false
})

// e.g.: sprites.onOverlap(SpriteKind.Player, SpriteKind.Projectile, handler)
enum SpriteKind {
    Player,
    Projectile
}
class Sprites {
    public onOverlap(kind1: SpriteKind, kind2: SpriteKind, handler: () => void) {
    }
}
let sprites = new Sprites()
sprites.onOverlap(SpriteKind.Player, SpriteKind.Projectile, () => { });