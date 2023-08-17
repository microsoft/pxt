let staticVar = 20
class Test {
    static staticVar: number
    private ___staticVar_is_set: boolean
    private ___staticVar: number
    get staticVar(): number {
        return this.___staticVar_is_set ? this.___staticVar : Test.staticVar
    }
    set staticVar(value: number) {
        this.___staticVar_is_set = true
        this.___staticVar = value
    }

    static x: number
    private ___x_is_set: boolean
    private ___x: number
    get x(): number {
        return this.___x_is_set ? this.___x : Test.x
    }
    set x(value: number) {
        this.___x_is_set = true
        this.___x = value
    }

    instanceVar: number
    public static __initTest() {
        Test.staticVar = 9
        for (Test.x = 0; Test.x < 3; Test.x++) {
            Test.staticVar = Test.staticVar + 1
        }
        console.log(Test.x)
    }

    constructor() {
        this.instanceVar = 7
    }

    public instanceMethod() {
        let instanceMethodLocalVar = 5
        return this.instanceVar + instanceMethodLocalVar
    }

    public static staticMethod() {

        let staticMethodLocalVar = 4
        return staticMethodLocalVar + Test.staticVar + staticVar
    }

}

Test.__initTest()

