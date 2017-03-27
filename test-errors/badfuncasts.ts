namespace SomeBadFun {
    
    /*
    class Foo {
        a: number;
    }

    class Bar extends Foo {
        b: string;
    }

    function foo(f: Foo) {
        return new Bar()
    }

    type funFooBar = (x: Bar) => Bar

    g((y: Bar) => y)

    function g(h: funFooBar) {
        h(new Bar())
    }
*/

    enum EventType { Mouse, Keyboard }

    interface Event { timestamp: number; }
    interface MouseEvent extends Event { x: number; y: number }

    function listenEvent(eventType: EventType, handler: (n: Event) => void) {
        /* ... */
    }

    // Unsound, but useful and common
    listenEvent(EventType.Mouse, (e: MouseEvent) => {}); // TS9203
}
