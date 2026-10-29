function useStatusBars (list: StatusBarSprite[]) {
    console.log("" + (list[0]))
    list[0].setPosition(0, 0)
    list[0].value = 1
    list[0].setPosition(1, 1)
}
