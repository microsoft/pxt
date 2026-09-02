def on_pause_until():
    return input.button_is_pressed(Button.A)
pause_until(on_pause_until)
