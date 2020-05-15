The py-decompiler tests run the python decompiler on the test cases in the "cases/" folder and compare the output with the matching file names in the "baselines" folder.

This is very similiar in nature to the tests in "decompile-test/".

Test cases are whitespace insensative by default. To make a test case whitespace sensative, add: 
```
//%{ 'whitespaceSensative': true }
```
to the base case file.