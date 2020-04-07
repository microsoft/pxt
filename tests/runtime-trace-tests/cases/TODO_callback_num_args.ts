function onEvent(callback: (a: number, b: number) => void) {
    callback(7, 9)
}
onEvent(function (b: number) {
    console.log('hi!')
})