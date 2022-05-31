class Base:
    def __init__(self, num):
        pass

    def instanceM(self):
        print(1)
    def staticM():
        print(2)

class Sub(Base):
    def __init__(self):
        super().__init__(5)

    def instanceM(self):
        super().instanceM()
        print(3)
    def staticM():
        print(4)


x = Base(4)
y = Sub()



