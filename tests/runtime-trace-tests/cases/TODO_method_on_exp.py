class Foo:
    def doBar(self):
        return 3

def mkFoo():
    return Foo()

r = mkFoo().doBar()

print(r)