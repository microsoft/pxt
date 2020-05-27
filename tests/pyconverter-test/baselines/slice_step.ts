let testString = "hello"
testString = _py.stringSlice(testString, null, null, -1)
testString = testString.slice(0)
testString = testString.slice(1, 1)
let testArray = [0, 1, 2, 3]
testArray = _py.slice(testArray, null, null, 1)