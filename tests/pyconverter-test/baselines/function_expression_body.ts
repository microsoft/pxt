pauseUntil(function on_pause_until(): boolean {
    return input.buttonIsPressed(Button.A)
})
pauseUntil(function on_pause_until2(): boolean {
    return input.buttonIsPressed(Button.B)
})
input.onButtonPressed(Button.A, function on_button_pressed_a() {
    basic.showNumber(6)
})
input.onButtonPressed(Button.A, function on_button_pressed_a2() {
    basic.showNumber(5)
})
