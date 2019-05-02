function onChat(event: string, handler: () => void) {
    handler()
}
onChat("foo", () => console.log("bar"))