function onEvent(callback: (a: number, b: number) => boolean) {
    console.log(callback(3, 5) ? "t" : "f")
}
onEvent((b: number) => {
    return true
})
onEvent((b: number) => {
    return false
})