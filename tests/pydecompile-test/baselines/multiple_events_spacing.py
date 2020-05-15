basic.show_number(1)
basic.show_number(2)

def on_forever():
    basic.show_number(2)
basic.forever(on_forever)

def on_forever2():
    basic.show_number(3)
basic.forever(on_forever2)

basic.show_number(7)
basic.show_number(8)