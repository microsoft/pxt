# Karma test suite

The tests in this folder are run via `jake karma` and will be executed in a browser.


## Adding Blockly compiler tests

Tests for the Blockly compiler take a `.blocks` file as input and compare
the output against a baseline `.ts` file. To generate those files:

1. Add the required block definitions in the `test-library` directory. Make sure you add the `.ts` file you create to `pxt.json`. Note: do not add any C++ files, this library only accepts TypeScript!
2. Create the `.blocks` file for the test. There is no easy way to do it, but this is the method I follow:
    a. Copy the code you added in step 1 to some target (like `pxt-sample`)
    b. Run `pxt serve` in that target and create your test case in the editor
    c. Inside the `projects` directory of that target, a directory should have been created for the new project you just made in the editor. Grab the `main.blocks` file from that directory.
3. Place the `.blocks` file in the `cases` subdirectory.
4. Add the expected result `.ts` file _with the same name_ (but different file extension) to the `baselines` directory
5. In `test.spec.ts`, add a test case for your new files. Copy the other ones in that file and give it a relevant message.


## Debugging Karma tests

To debug the Karma tests, run `jake karma-debug`. This will launch the tests in the browser like usual but the browser will not close when the tests are finished. In the upper-right corner of the browser window, click on the button labelled "Debug". That will cause a new tab to open in which you can debug using the developer tools. The test files should be available in that window (look for `test.spec.js` and `commentparsing.spec.js`). Refresh the tab to re-run the tests.

Note: If you run `jake karma-debug`, the browser window that spawns will be un-closeable (if you try to close it, Karma will interpret that as a browser crash and immediately reopen it). To close the window, `CTRL-c` the process in the terminal.