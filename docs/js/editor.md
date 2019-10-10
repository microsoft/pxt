# Features of the JavaScript Editor

The JavaScript editor extends the features and functionality of the [Monaco Editor](https://github.com/microsoft/monaco-editor), the editor that powers Visual Studio Code.

Here is a list of some of the features supported by the Editor:

### Editing

The Editor contains a built-in JavaScript/Typescript language service that provides complete code intelligence.

### Coloring

The Editor automatically colors each of function and its respective namespace to match the colors of the respective block in the Block Editor.

![](/static/images/monaco-coloring.png)

This is the equivalent of the following blocks:

![](/static/images/monaco-coloring-blocks.png)

### Auto Suggest

Also known as IntelliSense, the editor supports automatic word completion.

If the language service knows possible completions, the IntelliSense suggestions will pop up as you type. You can always manually trigger it with ```Ctrl and Space```.  

![](/static/images/monaco-auto-suggest.png)

You can get additional information if you click the **'i'** symbol in the current suggestion.

![](/static/images/monaco-auto-suggest-info.png)

### Auto completion

Pressing ```Enter``` to any of the functions suggested by IntelliSense will automatically insert a snippet of the function declaration prefilling default values for each of the function parameters.

The default value is populated in one of the following ways: 
 - The default value in a @param JSdoc in the function declaration. 
 - Default values for primitive types. ```number: 0```, ```string: ""```, ```boolean: false```
 - If a parameter is an Enum, the first value of the Enum is inserted

### Parameter Hints

Parameter hints will pop up as you're typing a function invocation.

![](/static/images/monaco-parameter-hints.png)

### Quick Info

Hovering over namespaces, functions and function parameters will show useful information describing the purposes of the function, namespace, or parameter. 

![](/static/images/monaco-quick-info.png)

### Bracket Matching

Matching brackets are highlighted as soon as the cursor is near one of them. 

![](/static/images/monaco-bracket-matching.png)

```Tip: You can jump to the matching bracket with Ctrl and Shift and \```

### Errors

The Editor's language service is constantly analyzing your code for errors in the background.
Errors are surfaced to the user in one of two different ways: 
- Red squiggly or wavy lines appear beneath your code that is incorrect
- An Error bar snaps to the first error in the list 

![](/static/images/monaco-errors.png)

### Zoom

You can change the editor's font size by zooming in or out the editor content. 
Use ```Ctrl and +``` and ```Ctrl and -``` to zoom in/out.

### Find and Replace

The Editor supports Find, as well as Find and Replace in order to search for a particular keyword, or search and replace a particular keyword. 
You can get to the Find and Replace widget with ```Ctrl and f```, or you can also get to it via the All Commands window (see below).

![](/static/images/monaco-find-replace.png)

### Context Menu

Right clicking anywhere within the editor will bring up the context menu. 
The context menu will show you quick actions that you can complete by clicking one of the buttons that appear in the context menu.

Here are some of the actions currently supported: 
- Format Code: Quickly formats the document code 
- Show Commands: Opens up the All Commands view
- Save: Saves the document
- Run Simulator: Runs the simulator

![](/static/images/monaco-context-menu.png)

### All Commands

The All Commands view allows the user to search through all the commands available in the editor. 
To get to the all commands view press ```F1```, or right click to bring up the context menu, then click ```Show Commands```.

![](/static/images/monaco-all-commands.png)

### Language Support

The Monaco editor is also used for displaying other languages, including JSON, Cpp, Text and Assembly files. 

![](/static/images/monaco-other-languages.png)
