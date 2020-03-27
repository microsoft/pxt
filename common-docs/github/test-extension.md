# Test Extension

You can have one browser tab open with the test project, and another one with the extension. When you switch between them, each will reload automatically.

For testing TypeScript APIs you don't need a separate project, but instead you can
use the `test.ts` file in the extension itself. It is only used when you run the extension
directly, not when you add it to a project. You can put the TypeScript test code in there.
