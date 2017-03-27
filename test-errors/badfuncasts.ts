namespace SomeBadFun {

    enum EventType { Mouse, Keyboard }

    interface Event { timestamp: number; }
    interface MouseEvent extends Event { x: number; y: number }

    function listenEvent(eventType: EventType, handler: (n: Event) => void) {
        /* ... */
    }

    // Unsound, ruled out in Static TypeScript 
    // MouseEvent is a subtype of Event (should be a supertype)
    listenEvent(EventType.Mouse, (e: MouseEvent) => {}); // TS9203
}
