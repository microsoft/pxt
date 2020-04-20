enum Foo {
    First,  
    Last,
}

enum Bar{ Last=Foo.Last, Delete };

let x = Bar.Delete; // TS9210 - cannot compute enum value

