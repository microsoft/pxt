class ControllerButtonEvent(Enum):
	Pressed = 0
	Released = 1
class Button:
	def onEvent(self, eventType: ControllerButtonEvent, callback: Callable[[number, number], bool]):
		print("t" if callback(3, 5) else "f")
class Controller:
	def __init__(self):
		self.anyButton = Button()

controller: Controller = Controller()
class SpriteKind(Enum):
	Player = 0
	Projectile = 1
class Sprites:
	def onOverlap(self, kind1: SpriteKind, kind2: SpriteKind, handler: Callable[[], None]):
		pass
sprites = Sprites()