# Async and threads

## Background

JavaScript is generally speaking single threaded (there are web workers and other such inventions, but these are generally considered separate processes, that share no address space with the main process). If a function needs to wait for
some input (e.g., web request), you need to supply a callback function that gets
executed when the data is available.
```typescript-ignore
downloadData("https://example.com/", (err, data) => {
    if (err) { ... }
    else {
        let parsed = JSON.parse(data)
        ...
    }
})
```
This becomes somewhat problematic when you start to nest these.

One way to fix this is to use promises, but the idea
remains the same --- in the `.then()` handler you provide the function to execute
when data is available, but the advantage is that you can often avoid nesting
them (functions returning promises are often by convention called `somethingAsync`):
```typescript-ignore
downloadDataAsync("https://example.com/")
    .then(data => {
        let parsed = JSON.parse(data)
        ...
    }, err => { ... })
    .then(() => downloadDataAsync("https://somewhere-else.com/"))
    .then(somewhere => ...)
```

There are proposals of introducing C#-style `async`/`await` to JavaScript.
In fact TypeScript can compile `async/await` to ES6 generators (yield).
In that case you can use `await` operator to make a call to a promise-returning
function look sequential:
```typescript-ignore
let parsed = JSON.parse(await downloadDataAsync("https://example.com/"))
...
let somewhere = await downloadDataAsync("https://somewhere-else.com/")
...
```

Needless to say, this is way more readable and easier to get right than
the previous two solutions. In fact, it lets you simulate
cooperative multithreading --- you think you have multiple threads,
but only one of them runs at any given time, and you can be sure
your thread will not get interrupted until the point where it uses `await`.

## Promise? Await? And what is that `for` loop thing again?

Now, all of this is great, but not really something you want to explain
to someone who's just trying to learn what a `for` loop is.

For this reason, PXT lets users call async functions, as if they were
regular functions. This loses information about where your thread can
be interrupted, but we can hopefully recover that in the IDE (by for example
displaying a little clock next to async calls).

```typescript-ignore
let parsed = JSON.parse(downloadData("https://example.com/"))
...
let somewhere = downloadData("https://somewhere-else.com/")
...
```

Supporting async functions this way is one of the main reasons why we have
our own compilation scheme from TypeScript to JavaScript (cross-browser
debugger is another major one).

## Implementing async functions

Currently, to implement an async function, you first need to add `//% promise`
attribute to the declaration:

```typescript-ignore
//? Downloads data from remote site.
//% promise shim=basic::downloadData
export function downloadData(url:string) { return "" }
```

In the simulator you return a promise:

```typescript-ignore
export function downloadData(url:string) {
    return new Promise<string>((resolve, reject) =>
        $.get(url, (data, status) => {
            resolve(data)
        }))
}
```

It is also possible to use `//% async` and use `getResume()` function
to get a callback. You can see some older code do that.

Note, that you can [generate TypeScript definition](/simshim) from the
simulator files, which will take care of the `//% promise` and `//% shim=...` annotations.
