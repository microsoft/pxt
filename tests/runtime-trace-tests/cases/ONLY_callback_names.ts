function onEvent(callback: (a: number) => boolean) {
    console.log(callback(3) ? "t" : "f")
}
onEvent(() => true)
onEvent(() => false)