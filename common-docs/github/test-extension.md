# Testing an Extension

Both the extension and a test project are open in separate editor tabs in the browser. You can work on both simultanously as you add and modify your extension code. As you switch between them, each will reload automatically.

## API Tests

To test TypeScript APIs regularly, you don't need to have a separate test project available that has code to exercise the APIs. Instead, you include a `test.ts` file in the extension itself which contains the tests. This file is only used when you run the extension directly, not when you add the extension to a project. The tests you create are valid code that use your extension APIs.
