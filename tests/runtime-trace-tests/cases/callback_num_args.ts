function onEvent(callback: (a: number) => void) {
    callback(1)
}
onEvent(function () {
    console.log('hi!')
})