# Adding samples

The [Playground](/playground) has samples to show how to define different kinds of blocks. These range from basic blocks for functions to blocks for field editors. To help illustrate another block type, you can add your own sample to the list.

## Steps to add more samples

1. Create a folder for the sample, or a category folder with a sample folder, under `samples`. Something like `basic/hello-world`. 
2. Add a `sample.js` file inside that folder. Even though the extension is `.js` this is actually a [TypeScript](https://www.typescriptlang.org/docs/home.html) file.
3. Once you've added the `sample.js` where you want it, add an entry in `samples/all.js` for your new sample. That way it will show up in the dropdown list of available samples.

## Including a sample in `all.js`

The samples are held in the `PLAY_SAMPLES[]` array. You set the name, category, id, and path in the entry for your sample.

The entry attributes for the sample are:

* **chapter**: the category for the sample
* **name**: the sample's name which shows in the the selction dropdown list
* **id**: selection id (`<option value/>`) for the sample dropdown list
* **path**: the path to the sample - `sample` or `category/sample`

As an example, if you have a sample that shows how to set a namespace icon, the entry would look like this:

```json
{
    chapter: "Basic",
    name: "Set namespace icon",
    id: "basic-ns-icon",
    path: "basic/ns-icon"
},
```
