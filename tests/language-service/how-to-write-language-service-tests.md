
# Auto-complete tests
Add test cases to: **tests/language-service/cases**s.
Test cases are .ts files (TODO: add support for .py files).

A simple test case looks like:
```
testNamespace. // testNamespace.someFunction
```

Each line that ends in a "`.`" is a test case.
The comment after that case contains a "`;`" seperated list of qualified symbol names that MUST be present in the auto-complete results a user would see if they had just typed the "`.`".

Negative test cases can be written by using a "`!`" before the symbol name.
This says that that symbol MUST NOT be present.
```
3. // !Array.push
```

Sample code can be added to the **test-package** folder.
This sample code can be used in test cases.

Use the "TODO_" filename prefix to add a disabled test case.

Use the "ONLY_" filename prefix to run only that test case (do not commit this change).