def who():
    def whatever():
        a = 9
        nonlocal a # 9524
        if True:
            a = 2
        else:
            a = 3

    a = 1