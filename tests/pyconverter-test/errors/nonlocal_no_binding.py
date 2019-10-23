def who():
    def whatever():
        nonlocal a # 9523
        if True:
            a = 2
        else:
            a = 3