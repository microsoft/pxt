The py-decompiler tests run the python decompiler on the test cases in the "cases/" folder and compare the output with the matching file names in the "baselines" folder.

This is very similiar in nature to the tests in "decompile-test/".

Test cases are whitespace insensitive by default. To make a test case whitespace sensitive, add: 
```typescript
//%{ "whitespaceSensitive": true }
```
to the base case file.