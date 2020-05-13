function return_void() {
    let x = true
}

function return_simple(): number {
    return 0
}

function return_recursive(a: number): number {
    if (a <= 0) {
        return return_simple()
    } else {
        return return_recursive(a - 1)
    }
    
}

return_recursive(3)
