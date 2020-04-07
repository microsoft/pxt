radio.onReceivedString(function (receivedString) {
  basic.showString(receivedString)
})
radio.onReceivedNumber(function (receivedNumber) {
  basic.showNumber(receivedNumber)
})