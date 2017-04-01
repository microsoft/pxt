# Micro:bit Editor v0.9.66

This release is mostly contains bug fixes and performance improvements... along with cool new features.

https://youtu.be/Ah4fEbJtklU

## Custom blocks

The [custom blocks feature](/blocks/custom) allows to package JavaScript functions in a project 
and surface them as blocks in the editor. A typical scenario is to bundled 
some scafolding functions in a project and share it with students.

For example, the following JavaScript function

```typescript
namespace custom {
    /**
     * TODO: describe your function here
     * @param value describe value here, eg: 5
     */    
    //% block
    export function fib(value: number): number {
        return value <= 1 ? value : fib(value -1) + fib(value - 2);
    }
}
```

automatically gets loaded as blocks in the editor:

![](/static/blog/microbit-0-9-66/customblocks.png)

## Revamped "getting started"

TODO: @sam

## Nicer embeddings

Shared project can be embedded in web pages and blogs. When this happens, the size of the editor is usually much small than the regular full screen when editing. We've worked on this experience so that your shared project look great... even when browsed from a mobile phone.

## Custom Bluetooth low energy service sample

Ever dreamed of rolling out your own BLE service? Now is the time!
Leveraging the package system from PXT, you can create your very own BLE services like
the [bluetooth temperature sensor service](https://github.com/Microsoft/pxt-bluetooth-temperature-sensor) sample.

## New projects

In the [Milk Carton Robot](https://pxt.microbit.org/projects/milk-carton-robot), you turn a used milk carton into a funny robot.

Peter Heldens [@peterheldens](https://twitter.com/peterheldens) contributed the [Milk Monster](https://pxt.microbit.org/projects/milky-monster) in English and Dutch!

[Flip a coin](https://pxt.microbit.org/projects/coin-flipper) and learn about conditionals.