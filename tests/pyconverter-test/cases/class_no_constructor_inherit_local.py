class Foo:
    def __init__(self, value):
        pass

    def hello(self):
        pass

class Bar(Foo):
    def goodbye(self):
        pass

y = Bar(5)
y.hello()
y.goodbye()