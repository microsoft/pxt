# Blocks Tests

Blocks tests are `.blocks` files that get checked into a target's bundled extensions. The goal
of these tests is to detect when a breaking change is accidentally made to the underlying XML
we use to persist blocks projects. When the XML breaks it can cause user programs to have unexpected
behavior or fail entirely.

## Adding blocks tests

To add a blocks test for a bundled package:

1. Go to the editor in a browser and add `?saveblocks=1` to the URL
2. Create a new project that uses blocks from the package. The project doesn't need to "do" anything, but it should use as many blocks as possible.
3. Click the "save" button to download the `.blocks` file (not the download button)
4. Place the `.blocks` file into the package's directory. Name it something useful (but not `main.blocks`)

## How to fix a broken test

If the error message mentions that a block ID changed, open the blocks file in the editor and see what block is missing.

If the error message looks like a random exception, it might be caused by field editors. See the debugging section below.

Otherwise, if a test fails, you should get an error message telling you exactly which XML node is broken.

If the break is intentional (e.g. adding a new feature to a block), you can fix the test case by
dragging the `.blocks` file into the editor and fixing the errors. Follow the steps above to re-download
the new `.blocks` file and replace the old one. **Make sure you add an upgrade rule for the API that changed!!!**

If the break is unintentional, the cause is usually one of the following:

1. The authoring of the function changed
2. The flags in `pxtarget.json` changed
3. The `pxt-core` or `pxt-common-packages` version changed. If this is the cause then it usually means other editors are affected as well.


## That didn't help, I need to debug!

To debug the tests, run `pxt testblocks --debug` from the root of the target. Now the browser will not close after finishing
the tests and you should be able to click the "debug" button in the upper right. That button will open a blank page that will
run the tests and allow debugging.