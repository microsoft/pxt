namespace SomeBadFun {

    enum EventType { Mouse, Keyboard }

    interface Event { timestamp: number; }
    interface MouseEvent extends Event { x: number; y: number }

    function listenEvent(eventType: EventType, handler: (n: Event) => void) {
        /* ... */
    }

    // Unsound, ruled out in Static TypeScript 
    // MouseEvent is a subtype of Event (should be a supertype)
    // no function parameter bivariance
    listenEvent(EventType.Mouse, (e: MouseEvent) => {}); // TS9203

    interface FunWithField {
        (x:number, y:number): number;
        a? : string
    }
    // functions can't be cast to interfaces in STS
    let add  = function (x:number,y:number) { return x + y }  
    let addWithExtra : FunWithField = add   // TS9203
    addWithExtra.a = "hi"

    interface ArrWithField {
        [x:number]: number;
        a? : string
    }
    let arr = [ 1, 2 ,3]
    // can't do with arrays either
    let arrWithExtra: ArrWithField = arr // TS9203
 
}