def f1():
    x = [1, 3, 4]
    while True:
        y = x.reduce(on_reduce, "hello")
        z = x.reduce(on_reduce, 1)

def on_reduce(previousValue, currentValue, currentIndex):
    return previousValue + currentIndex