def on_button_pressed_a():
    global fred
    fred += 1
def on_button_pressed_b():
    global fred
    fred += -1
fred = 0
def on_forever():
    basic.show_number(fred)
basic.forever(on_forever)