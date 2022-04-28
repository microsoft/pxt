def f1():
    x = ["a", "b", "c"]
    z = [0, 1, 2]
    while True:
        a = x.slice()
        b = z.concat(z)
        c = x.fill("u", 1, 1)
        d = z.filter(filt)
        e = x.remove_at(1)
        f = z.shift()
        g = x.get(0)
        h = z._pick_random()

def filt(a):
    return True