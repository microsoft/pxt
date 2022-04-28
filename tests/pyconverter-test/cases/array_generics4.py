x = ["hello"]
y = None

def whatever(arg):
    global y
    y = arg

whatever(x.remove_at(0))