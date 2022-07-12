staticVar = 20

class Test():
    staticVar = 9

    for x in range(3):
        staticVar = staticVar + 1

    print(x)

    def __init__(self):
        self.instanceVar = 7

    def instanceMethod(self):
        instanceMethodLocalVar = 5
        return self.instanceVar + instanceMethodLocalVar

    def staticMethod():
        global staticVar
        staticMethodLocalVar = 4
        return staticMethodLocalVar + Test.staticVar + staticVar

