def on_pause_until():
    return input.button_is_pressed(Button.A)
pause_until(on_pause_until)

def on_pause_until2():
    return input.button_is_pressed(Button.B)
pause_until(on_pause_until2)

def on_button_pressed_a():
    basic.show_number(6)
input.on_button_pressed(Button.A, on_button_pressed_a)

def on_button_pressed_a2():
    basic.show_number(5)
input.on_button_pressed(Button.A, on_button_pressed_a2)
