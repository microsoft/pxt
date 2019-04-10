function onChat(command: string, handler: (num1: number, num2: number, num3: number) => void) {
    console.log("command: " + command)
    handler(1, 2, 3)
}

onChat("chicken", function () {
    for (let i = 0; i < 10; i++) {
        console.log("spawn chicken!")
    }
})