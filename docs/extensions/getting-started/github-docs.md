# Adding documentation for GitHub extensions

Extensions hosted on GitHub can include help pages for blocks/APIs they export. A user can open the help page for a block by right-clicking on it in the editor and selecting "Help".

As with all MakeCode documentation, these pages are written in GitHub Flavored Markdown (with some extended markdown that is specific to MakeCode). This page will walk you through how to add documentation to an existing MakeCode extension that is hosted in GitHub.

## Step 1: Repo file structure

It's common practice to put all of the markdown documentation inside of a directory named `docs/` at the top-level of the repo. For this example extension, we will assume that the file layout of the extension repo looks like this:

```
root/
├─ pxt.json
├─ main.ts
├─ docs/
   ├─ custom-block1.md
   ├─ custom-block2.md
```

Where `custom-block1.md` and `custom-block2.md` are documentation files we want to show as the help pages for two custom blocks.

## Step 2: Create the markdown file

Help pages for MakeCode blocks typically contain these sections (in order):

* Title/description
* Signature
* Parameters
* Example
* See also
* Package metadata

### Title/Description

This should contain a brief description of the functionality of the block/API along with a title for the page. Often, this text can simply be copied from the existing JSDoc of a particular API.

### Signature

MakeCode has a built-in markdown extension for automatically generating a "signature" code snippet in the page that shows your API written in blocks, JavaScript, and Python. To create a signature, simply create a code block in your markdown file and tag the code block with the `sig` language like so:

````markdown
```sig
myNamespace.customApi("hello", 1);
```
````

Note that the contents of the `sig` code block must be valid TypeScript that compiles in order for it to render properly. If your snippet requires a variable, simply declare the variable above the signature line in the snippet:

````markdown
```sig
let myInstance: myClass;
myInstance.method("whatever");
```
````

The declaration of the variable will be automatically omitted from the embedded code snippet when the signature is rendered.

If your block/API has optional parameters, list **all** of the parameters including the optional ones in the signature.

### Parameters

Parameters should be listed in order using a bulleted list. Each entry should have the parameter name in **bold**, followed by a plain language description of the parameter that includes the expected type. If the parameter is optional, note that in parentheses next to the parameter name.

For example:

```markdown
* **parameter1**: a string to be printed to the console
* **parameter2** (optional): the number of times to print the message
```

If any parameters require a more detailed description than you can provide in one or two sentences, you can add additional documentation below this list in paragraph format.

### Example

The _Example_ section of the page should provide an example MakeCode program that demonstrates how to use the block/API being documented. Users will be able to open your examples in the MakeCode editor using the buttons that appear next to the code snippets. For each example, be sure to also give a brief description of the code.

You can specify the language an example is rendered in by using the language tag in the code snippet. For example:

````markdown
# Example 1

This example will render as blocks:
```blocks
<code here>
```

# Example 2

This example will render as typescript:
```ts
<code here>
```
````

If your example requires an extension other than your own, be sure to include that extension in the metadata of the page. See the [page metadata](#page-metadata) section below for more details.


### See also

The see also section is an optional section where you can link to related documentation pages:

```markdown
## See also
* [some api](./some-api)
* [some other api](./some-other-api)
```

### Page metadata

Every extension documentation page requires metadata that tells MakeCode which extension needs to be loaded in order to render the code snippets on the page. At the minimum, this metadata should contain an entry for your own extension in order for any of the snippets to render properly. Extensions are declared in a `package` specification block, typically at the end of the markdown page.

The package metadata follows this format:

````markdown
```package
my-custom-extension=github:username/extension-repo
```
````

Each entry in the `package` code block should be formatted like so:

```
<extension-name>=github:<github-username>/<github-repo>
```

The `<extension-name>` in the above snippet should be the name that appears in the `pxt.json` name field of your extension. It's best practice to make sure that this name always matches the `name` set in your extension's `pxt.json` file.

If your repository contains multiple extensions, add the path to the directory containing the desired extension's `pxt.json` file after the github repo like so:

```
<extension-name>=github:<github-username>/<github-repo>/path/to/extension
```

To add more extensions, simply add each on a new line within the `package` code block. This can be useful if your example code needs to reference APIs from another extension:

````markdown
```package
my-custom-extension=github:username/extension-repo
my-other-extension=github:username/different-extension-repo
```
````

### Full example markdown

Here is a full example markdown page for a file read API:

````markdown
# file read

Reads the contents of a file from the file system

```sig
files.read("/path/to/file.txt", "UTF-8")
```

## Parameters

* **path**: a string that contains the path to the file on disk
* **encoding**: the encoding of the file to be read

## Example

This example reads from a file on disk and prints the contents to the console.

```blocks
const contents = files.read("/path/to/file.txt", "UTF-8");
console.log(contents)
```

## See also
* [write file](./write-file)

```package
my-custom-extension=github:username/extension-repo
```
````

## Step 3: Add the markdown file to pxt.json

All documentation files must be included in the `files` entry of the extension's `pxt.json` file. For example:

```json
{
    "name": "my-custom-extension",
    "version": "0.0.1",
    "description": "",
    "dependencies": {
        "device": "*"
    },
    "files": [
        "main.ts",
        "README.md",
        "docs/my-custom-block.md",
    ],
    "testFiles": [
        "test.ts"
    ],
    "supportedTargets": [
        "arcade"
    ],
    "preferredEditor": "tsprj"
}

```

## Step 4: Add a comment annotation to the function

Once you have a markdown file added to your extension, it's time to link that page to the function using a comment annotation by specifying a "help path".

The annotation should be of the following format:

```
//% help=github:my-extension-name/docs/my-custom-block
```

This is added to the other annotations and jsDoc for the function or method in your extension's code:

```typescript-ignore
/**
 * Example function in my example extension.
 * @param value that is also returned
 */
//% block="my custom block %value"
//% help=github:my-extension-name/docs/my-custom-block
export function myCustomBlock(number value) {
   return value
}
```

The `my-extension-name` in the above snippet should match the name listed in the `name` field of the extension's `pxt.json` file. Also, note that the file path does not contain the `.md` file extension.

## Step 5: Commit your changes and test

Once you've commited your changes to master, you can test before pushing a release by creating a MakeCode project that points to a commit with your changes.

1. In your github repo, copy the SHA hash for the commit that you want to test
2. In MakeCode, create a new project
3. Add your extension to the project
4. Switch to JavaScript and open `pxt.json` in the file explorer that appears below the simulator
5. Find the entry for your extension in the `dependencies` object
6. Replace any `#version` that appears at the end of the entry with `#<sha>` where `<sha>` is the hash you copied in step 1

For example, this pxt.json:

```json
{
    "name": "Untitled",
    "description": "",
    "dependencies": {
        "device": "*",
        "arcade-character-animations": "github:microsoft/arcade-character-animations#v0.0.1"
    },
    "files": [
        "main.blocks",
        "main.ts",
        "README.md",
    ],
    "preferredEditor": "tsprj"
}
```

would become:

```json
{
    "name": "Untitled",
    "description": "",
    "dependencies": {
        "device": "*",
        "arcade-character-animations": "github:microsoft/arcade-character-animations#8eb6817dfe7542ba533ae843a5850bf12d9fc9c0"
    },
    "files": [
        "main.blocks",
        "main.ts",
        "README.md",
    ],
    "preferredEditor": "tsprj"
}
```

Once you've made these changes, switch back to `main.ts` and reload the page. Your project should now have the version of your extension from that commmit.

## Step 6: Create a release to push your changes

To release your documentation changes, create a new version of your extension.

If you are working using the [makecode CLI](https://github.com/microsoft/pxt-mkc), then simply run `makecode bump` from within the root of your extension's directory.

If you are working from within MakeCode, use the **Create Release** button that appears in the GitHub settings for your extension.

Otherwise you can push a version manually by changing the version in `pxt.json` and pushin a new tag in your repo of the format `v0.0.0` (where `0.0.0` is replaced with the new version in `pxt.json`).
