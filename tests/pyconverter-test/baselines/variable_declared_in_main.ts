function on_button_pressed_a() {

    fred += 1
}

function on_button_pressed_b() {

    fred += -1
}

let fred = 0
basic.forever(function on_forever() {
    basic.showNumber(fred)
})