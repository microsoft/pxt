let salutation = "hello"
let language = ""

switch (salutation) { // TS9226
    case "hello":
        language = "english"
        break;
    case "bonjour":
        language = "french"
        break;
    default:
        break
}

let message = ""

// Switch statements with fallthroughs should compile
switch (2) {
    case 0:
    case 1:
        message = "Zero or one"
        break
    default:
        message = "Not zero or one"
        break
}
