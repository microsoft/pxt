def topfun():
    def subfun():
        nonlocal a
        a = 2
    a = 1