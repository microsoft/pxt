class MySprite(sprites.ExtendableSprite):
    def __init__(self):
        super().__init__(5)

    def draw(self, drawLeft, drawTop):
        super().draw(drawLeft, drawTop)