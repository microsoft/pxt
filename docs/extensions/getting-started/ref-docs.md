# Reference documents

the documentation for the functions in an extension namespace are included with the extension. They are markdown files written in the format described by [writing docs](https://makecode.com/writing-docs).

## Step 0: Document tree discussion

Documentation for namespace functions almost always goes under the _/reference_ document path. Other standard document paths are _/blocks_ and _/types_ but these are for the documents related to built-in blocks. If an extension has other related documents that aren't for namespace functions, such as hardware associated with the API in the extension, these are placed under another path, like _/device_, in the extension.

### Document file layout

Earlier you saw that the `tropic.ts` and `pxt.json` files were placed under the _/tropic_ folder. To add documents, make a folder called _/docs_ under that one. You put the documents for the namespace functions under a _/reference/<namespace>_ folder. The file layout, including the documents for the two functions in the **tropic** namespace, looks like this:

```
/libs
    /tropic
        /docs
            /reference
                /tropic
                    peel.md
                    pick.md
                tropic.md
        tropic.ts
        pxt.json
```

Again, the individual reference document files are placed under _/tropic_ which is under _/reference_. This maps the `tropic` namespace documents under the global reference document tree for the target. The referring URI for the **peel** function when served locally is:

```
localhost:3232/reference/tropic/peel
```

### Additional paths

If your extension needs to include some additional information that's not reference related, you add that in another folder under _/docs_. Also, if you include other namespaces in the same extension, the documents for those follow the same layout structure but in a different folder under the namespace folder. In this example, there's a document for some device information and another namespace called `cabana`:

```
/libs
    /tropic
        /docs
            /device
                banana-switch.md
            /reference
                /cabana
                    /sleep-in.md
                /tropic
                    peel.md
                    pick.md
                cabana.md
                tropic.md
        cabana.ts
        tropic.ts
        pxt.json
```

## Step 1: Create the document tree

Under the _/tropic_ folder create a folder path called: _/docs/reference/tropic_

## Step 2: Write the reference document: `pick.md`

There's no required format for writing the reference documents. However, current convention is for reference documents to contain these elements, when applicable:

1. Use the function name as the title in a first level heading: `# peel`.
2. A short paragraph overview of what the function does.
3. The signature of the function.
4. A list of parameters (if any) with their types and descriptions.
5. The return value (if any) description and it's type information.
6. A example use of the function.
7. Any **See also** links to related reference or external information.
8. An extension tag associating the document with it's extension.

**NOTE:** The document sections that come after the title heading begin at second level (`##`) headings.

Here's a simple first revision of a reference document for  _pick.md_:

````markdown
# pick

Select an available tropical fruit to eat.

```sig
tropic.peel(TropicalFruit.Banana)
```

## Parameters

* **type**: a `TropicalFruit` to eat, which is either: `banana`, `pineapple`, or `coconut`.

## Returns

* a [boolean](/types/boolean) value which is `true` if the fruit was picked, `false` if not.

## Example

Try and pick a coconut from a tropical tree. Can you peel it?

```blocks
let peeled = false
if (tropic.pick(TropicalFruit.Coconut)) {
    peeled = tropic.peel(TropicalFruit.Coconut)
}
```

## See also

[peel](/reference/tropic/peel)

```package
tropic
```
````

Copy the markdown for the **pick** function reference and save it as _pick.md_ under _/docs/reference/tropic_ in the extension folder.

## Step 3: Write the reference document: `peel.md`

Do the same thing as in **Step 2** and copy the markdown here but save it as _peel.md_ for the other function in `tropic`:

````markdown
# peel

Try to peel a tropical fruit to eat.

```sig
tropic.peel(TropicalFruit.Banana);
```

## Parameters

* **fruit**: a `TropicalFruit` to peel and eat, which is either: `banana`, `pineapple`, or `coconut`.

## Returns

* a [boolean](/types/boolean) value which is `true` if the fruit was peeled, `false` if not.

## Example

Try and pick a coconut from a tropical tree. Can you peel it?

```blocks
let peeled = false
if (tropic.pick(TropicalFruit.Coconut)) {
    peeled = tropic.peel(TropicalFruit.Coconut)
}
```

## See also

[pick](/reference/tropic/pick)

```package
tropic
```
````

## Step 4: Set the help attributes

Now, go back and open `tropic.ts` again in an editor. We need to add the `help` attribute to each function in order to associate the new documents as help content for the blocks.

For **pick**, add:

```typescript-ignore
//% help=tropic/pick
```

For **peel**, add:

```typescript-ignore
//% help=tropic/peel
```

So that the namespace code looks like:

```typescript-ignore
/**
 * Pick some fruit and peel it.
 */
//% weight=70 icon="\uf185" color=#EC7505
namespace tropic {
    /**
     * Pick a fruit
     */
    //% blockId=tropic_pick block="pick a %type"
    //% help=tropic/pick
    export function pick(type: TropicalFruit): boolean {
        return true;
    }
    /**
     * Peel the fruit if possible
     */
    //% blockId=tropic_peel block="peel a %fruit"
    //% help=tropic/peel
    export function peel(fruit: TropicalFruit): boolean {
        return (fruit == TropicalFruit.Banana);
    }
}
```

## Step 5: Make a card page

A nice feature of the MakeCode document system is generation of cards for code statements and
functions based on signature. The cards show a block from the compiled code of the function in the namespace. Also, the description from the JsDoc is extracted and displayed in the card.

Card pages form the top levels of the reference document tree (usually the second level after the reference page: _reference.md_).

### ~hint
The card page isn't automatically added to the top level reference page, _reference.md_,  when an extension is added. If an extension is included with a target statically, the card page is added manually in a [namespaces](/writing-docs/macros#namespaces) section.
### ~

Cards are declared in a [**cards**](/writing-docs/macros#cards) section in the card markdown page. You have the option of exposing some or all of the available functions from your namespace in the card page. The document for the card page is placed in the _/reference_ folder and has the same name as the namespace folder but with the markdown (md) extension.

Here's the card page for the `tropic` namespace extension called `tropic.md`:

````markdown
# Tropic

The functions to pick, peel, and eat tropical fruit.

## Reference

```cards
tropic.pick(TropicalFruit.Coconut);
tropic.peel(TropicalFruit.Cocount);
```

```package
tropic
```
````

Copy the markdown for the card page and save it as _/docs/reference/tropic.md_.

## Step 6: Try out the documents!

Everything's in place now to make the documents work with the blocks and the in the _/reference_ document path. Stop and restart the target to have `pxt serve` rebuild the extension with the new documents.

Open a new browser page and navigate to ``localhost:3232/reference/tropic``. You should see the card page for **Tropic** appear. Click on one of the cards to see a reference page.

Go back over to the editor and in the blocks view, right-click one of the blocks from the **Tropic** extension. Select **help** in the menu and see the reference show up in the doc slider.

**NEXT:** add a [class and use object instances](./objects-instances) in your extension namespace.

## See also

[Sources](./sources) for the extension tutorial