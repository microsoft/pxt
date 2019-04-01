Motivation (from a Teams Discussion)
TODO re-organize and format nicely for posterity

I'm thinking about making a test suite that compares stdout traces of programs compiled and/or run using:

static typescript (STS)
	static python (SPY) 
	true typescript & node (TS)
	python3 (PY)

It'd be a test suite to ensure our runtime semantics match up between the 4 languages above (and maybe blocks?)

The test suite can test all of or any of: STS, ts2py, and py2ts, but will still be able to localize errors to one of {STS, ts2py, py2ts}, as shown below.

The inputs would consist of .ts and .py files with console.log/print statements (but without assert statements)

The chain of tests that could be run on each .ts file:

TS(foo.ts) => baseline trace
	STS(foo.ts) => static typescript trace, a difference here would indicate a STS problem
	ts2py(foo.ts) => gives foo.ts.py
	PY(foo.ts.py) => if different than baseline trace then this indicates a ts2py problem
	py2ts(foo.ts.py) => gives foo.ts.py.ts, if different than foo.ts it's not necessarily an error but may help localize issues in step 6 & 7
	TS(foo.ts.py.ts) => if different than baseline trace then this probably indicates a py2ts problem
	STS(foo.ts.py.ts) => if different than baseline trace then this probably indicates a STS problem

The chain of tests that could be run on each .py file:

PY(foo.py) => baseline trace
	py2ts(foo.py) => gives foo.py.ts
	TS(foo.py.ts) => if different from baseline trace, indicates a py2ts problem
	STS(foo.py.ts) => if different from baseline trace, indicates a STS problem
	ts2py(foo.py.ts) => gives foo.py.ts.py, if different than foo.py it's not necessarily an error but may help localize issues in step 6
	PY(foo.py.ts.py) => if different from baseline trace, probably indicates a ts2py problem
 
Notice how each test step nicely localizes problems. Also, I like that these tests don't depend on checked-in baselines or asserts, don't care about the syntax that ts2py and py2ts output since this may change over time, and can be written in either .py or .ts depending on which is most appropriate but both .ts and .py files will test each of {STS, py2ts, ts2py}

We could also have a set of .ts and .py files that are known to not pass one or more of the steps above. This would be a handy way to document the gaps between STS and SPY and "true" typescript and "true" python, respectively.

---

Looks like STS compiling and running (without a target) is done in tests/compile-test which is great, but it doesn't seem to compare with tsc & node.js as a baseline. What would be great about using node.js/tsc/python3 to create a baseline is that you wouldn't need to write any assert statements, just console.log/print messages, which I believe will make it easier to write test cases.

---

We have a huge advantage with STS and SPY that most languages/compilers don't have: we have (near-)perfect oracles in the form of tsc/node.js & python3

---

git ignore & remove before each run:
    *_trace
    *_error
    *.ts.py*
    *.py.ts*

cases = (*).(ts|py)

TS x: 
    tsc x | node
PY x: 
    python3 x

run_oracles:
    ∀ x where ∃ x.ts ∧ ∄ x.ts.nodejs_trace:
        TS(x.ts) > x.ts.nodejs_trace
    ∀ x where ∃ x.py ∧ ∄ x.py.python3_trace: 
        PY(x.py) > x.py.python3_trace
run_sts:
    ∀ x where ∃ x.ts ∧ ∄ x.ts.sts_trace:
        TS(x.ts) > x.ts.sts_trace
do_conversions:
    ∀ x where ∃ x.ts ∧ ".ts.py" ∉ x ∧ ∄ x.ts.ts2py_error: 
        ts2py(x.ts) > x.ts.py or x.ts.ts2py_error
    ∀ x where ∃ x.py ∧ ".py.ts" ∉ x ∧ ∄ x.py.py2ts_error: 
        py2ts(x.py) > x.py.ts or x.py.py2ts_error
check_sts:
    ∀ x where ∃ x.sts_trace ∧ ∃ x.nodejs_trace:
        if x.sts_trace != x.nodejs_trace:
            sts_error(x) > x.sts_error
check_conversions:
    ∀ x where ∃ x.ts.py.python3_trace ∧ ∃ x.ts.nodejs_trace:
        if x.ts.py.python3_trace != x.ts.nodejs_trace:
            ts2py_error(x) > x.ts.ts2py_error
    ∀ x where ∃ x.py.ts.nodejs_trace ∧ ∃ x.py.python3_trace:
        if x.py.ts.nodejs_trace != x.py.python3_trace:
            py2ts_error(x) > x.py.py2ts_error
report:


main:
    run_oracles
    while progress:
        run_sts
        check_sts
        do_conversion
        run_oracles
        check_conversions
    

    TS -> STS -> ts2py -> PY -> py2ts -> TS

    TS(foo.ts) => baseline trace
	STS(foo.ts) => static typescript trace, a difference here would indicate a STS problem
	ts2py(foo.ts) => gives foo.ts.py
	PY(foo.ts.py) => if different than baseline trace then this indicates a ts2py problem
	py2ts(foo.ts.py) => gives foo.ts.py.ts, if different than foo.ts it's not necessarily an error but may help localize issues in step 6 & 7
	TS(foo.ts.py.ts) => if different than baseline trace then this probably indicates a py2ts problem
	STS(foo.ts.py.ts) => if different than baseline trace then this probably indicates a STS problem

    PY(foo.py) => baseline trace
	py2ts(foo.py) => gives foo.py.ts
	TS(foo.py.ts) => if different from baseline trace, indicates a py2ts problem
	STS(foo.py.ts) => if different from baseline trace, indicates a STS problem
	ts2py(foo.py.ts) => gives foo.py.ts.py, if different than foo.py it's not necessarily an error but may help localize issues in step 6
	PY(foo.py.ts.py) => if different from baseline trace, probably indicates a ts2py problem