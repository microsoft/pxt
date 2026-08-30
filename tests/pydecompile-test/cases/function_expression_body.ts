pauseUntil(() => input.buttonIsPressed(Button.A))
pauseUntil(function() { return input.buttonIsPressed(Button.B) })

input.onButtonPressed(Button.A, () => basic.showNumber(6));
input.onButtonPressed(Button.A, function() { basic.showNumber(5) })