a = 3

def whatever():
    a = 9
    global a # 9522
    if True:
        a = 2
    else:
        a = 3