class Greeter {
    static greeting: string
    private ___greeting_is_set: boolean
    private ___greeting: string
    get greeting(): string {
        return this.___greeting_is_set ? this.___greeting : Greeter.greeting
    }
    set greeting(value: string) {
        this.___greeting_is_set = true
        this.___greeting = value
    }
    
    local: string
    public static __initGreeter() {
        Greeter.greeting = "default"
    }
    
    constructor(message: string) {
        console.log("constructor: " + this.greeting)
        this.greeting = message
        this.local = "local"
    }
    
}

Greeter.__initGreeter()

let greeter = new Greeter("world")
console.log(greeter.greeting)
console.log(Greeter.greeting)
Greeter.greeting = "newdefault"
greeter = new Greeter("world")
console.log(Greeter.greeting)
greeter.greeting = null
console.log(greeter.greeting)
