class Base {
    constructor(num: number) {
        
    }
    
    public instanceM() {
        console.log(1)
    }
    
    public static staticM() {
        console.log(2)
    }
    
}

class Sub extends Base {
    constructor() {
        super(5)
    }
    
    public instanceM() {
        super.instanceM()
        console.log(3)
    }
    
    public static staticM() {
        console.log(4)
    }
    
}

let x = new Base(4)
let y = new Sub()
