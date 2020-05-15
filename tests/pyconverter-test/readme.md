The pyconverter tests take python input (from cases/ folder) and convert it to static typescript and syntactically  compare the output to the expected baselines in the baselines/ folder or expected errors in the errors/ folder.

By default test cases are whitespace insensitive. Add the following to the top of the test case to make it whitespace sensitive:
```python
#%{ "whitespaceSensitive": true }
```