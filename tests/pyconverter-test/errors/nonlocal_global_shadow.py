def outer():
    a = 2
    def middle():
        global a
        a = 3
        def inner():
            nonlocal a # 9523
            a = 1

a = 1