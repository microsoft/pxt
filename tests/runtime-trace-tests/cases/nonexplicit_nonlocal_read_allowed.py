def baz():
    foo = 2
    def bar():
        print(foo)
    bar()
baz()