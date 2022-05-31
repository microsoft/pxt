let staticVar = 20
class Test {
    static staticVar: number
    static x: number
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

