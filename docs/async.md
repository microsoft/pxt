# Async and threads

## Background

JavaScript is generally speaking single threaded (there are web workers and other such inventions, but these are generally considered separate processes, that share no address space with the main process). If a function needs to wait for
some input (e.g., web request), you need to supply a callback function that gets
executed when the data is available. 
```js
downloadData("https://example.com/", (err, data) => {
    if (err) { ... }
    else {
        let parsed = JSON.parse(data)
        ...
    }
})
```
This becomes somewhat problematic when you start to nest these.
A simple web search on "callback hell" will tell why.

One way to fix this is to use promises, but the idea
remains the same --- in the `.then()` handler you provide the function to execute
when data is available, but the advantage is that you can often avoid nesting
them (functions returning promises are often by convention called `somethingAsync`):
```js
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
```js
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

```js
let parsed = JSON.parse(downloadData("https://example.com/"))
...
let somewhere = downloadData("https://somewhere-else.com/")
...
```

Supporting async functions this way is one of the main reasons why we have
our own compilation scheme from TypeScript to JavaScript (cross-browser
debugger is another major one).

## Implementing async functions

Currently, to implement an async function, you first need to add `//% async`
attribute to the declaration:

```typescript
//? Downloads data from remote site.
//% async shim=basic::downloadData
export function downloadData(url:string) { return "" }
```

In the simulator you use `getResume()` function:

```typescript
export function downloadData(url:string) {
    let cb = getResume()
    $.get(url, (data, status) => {
        cb(data)
    })
}
```

You should call `getResume()` in the main function, not one of the callbacks,
as to not intercept the resume of some other thread.

If you forget `//% async` annotation, or add one and don't use `getResume()`
the simulator will crash.

In future we expect to automatically support regular promise-returning
`downloadDataAsync`, and also generate the TypeScript declaration automatically.
