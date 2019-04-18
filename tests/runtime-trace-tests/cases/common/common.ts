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
enum SpriteKind {
    Player,
    Projectile
}
class Sprites {
    public onOverlap(kind1: SpriteKind, kind2: SpriteKind, handler: () => void) {
    }
}
let sprites = new Sprites()