function doSomething () {
    control.runInBackground(() => {
        return
    })
    return 0
}
function doSomething2 () {
    control.runInBackground(() => {
        return 0
    })
}
basic.forever(function () {
    return
})
basic.forever(function () {
    return 0
})
