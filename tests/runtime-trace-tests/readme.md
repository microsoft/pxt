# What
Adds  a test suite that compares the runtime semantics of Static Typescript ["STS"] and Static Python ["SPY"] files with tsc+node.js ["TS"] and python3 ["PY"]. This is useful for testing the correctness of: ts2py, py2ts, and STS.

The test compares stdout traces of programs compiled and/or run using:
- static typescript
- static python
- true typescript & node
- python3

# Why
This suite was added primarily to test ts2py but also tests py2ts and the sts compiler.

These test supplement but do not replace the pydecompiler-tests. Instead of comparing the syntax of decompiled programs, they test the semantics of decompiled programs by looking at the programs trace. This makes it better for certain kinds of tests like testing variable scope semantics and worse at other types of tests like auto-generated variable names.

This test suite enables TDD of many ts2py features.

# How
The test suite tests all of or any of: STS, ts2py, and py2ts, but will still localize errors to one of {STS, ts2py, py2ts}, as shown below.

The inputs consist of .ts and .py files with console.log/print statements (but without assert statements)

The chain of tests that are run on each .ts file:

1. TS(foo.ts) => baseline trace
2. STS(foo.ts) => static typescript trace, a difference here would indicate a STS problem
3. ts2py(foo.ts) => gives foo.ts.py
4. PY(foo.ts.py) => if different than baseline trace then this indicates a ts2py problem
5. py2ts(foo.ts.py) => gives foo.ts.py.ts, if different than foo.ts it's not necessarily an error but may help localize issues in step 6 & 7
6. TS(foo.ts.py.ts) => if different than baseline trace then this probably indicates a py2ts problem
7. STS(foo.ts.py.ts) => if different than baseline trace then this probably indicates a STS problem

The chain of tests that are run on each .py file:

1. PY(foo.py) => baseline trace
2. py2ts(foo.py) => gives foo.py.ts
3. TS(foo.py.ts) => if different from baseline trace, indicates a py2ts problem
4. STS(foo.py.ts) => if different from baseline trace, indicates a STS problem
5. ts2py(foo.py.ts) => gives foo.py.ts.py, if different than foo.py it's not necessarily an error but may help localize issues in step 6
6. PY(foo.py.ts.py) => if different from baseline trace, probably indicates a ts2py problem
 
Notice how each test step localizes problems. Also, these tests don't depend on checked-in baselines or asserts, don't care about the syntax that ts2py and py2ts output since this may change over time, and can be written in either .py or .ts depending on which is most appropriate but both .ts and .py files will test each of {STS, py2ts, ts2py}.

## Adding a test
Simply add a .ts or .py file to tests/runtime-trace-tests/cases/ that exhibits the behavior you want to test. 

### Example: mutating loop variable semantics
For example, to ensure that ts2py correctly handles for loops where the loop variable is mutated during the loop, you could add a .ts file with:
```
for (let i = 0; i < 5; i++) {
    i++
    console.log(i)
}
```
Then run `jake testtraces`.
At the time of this writing, this test will fail on step #4 mentioned above because ts2py converts the file to:
```
for i in range(5):
  i += 1
  print(i)
```
which produces a different trace when run with python3 than the .ts file does when run with tsc+node.js.
Notice that it only took a simple 4 line program and no baseline files or assert statements to create a test that tests correctness of ts2py, py2ts, and sts.

This example is included as "TODO_scope_for_loop.ts". Note that files with "TODO_" will be ignored by the test runner.