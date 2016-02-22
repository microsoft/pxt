namespace radio {
/*    
    TODO: support for glue notations?
    var glue_json = {
        config: {
            MICROBIT_BLE_ENABLED: 0    }
        }; */

    /**
     * Sends a message id to other micro:bit in the group using radio.
     * {namespace:radio}
     * {weight:80}
     * {help:/functions/broadcast-message}
     * {shim:micro_bit::broadcastMessage}
     */
    export function broadcastMessage(message: number) : void
    {
        /*
        if (message < 0 || message > 65325) {
            simulator.warning("message should be between 0 and 65535.");
        }
        noBleWarning();
        */
    }

    /**
     * Registers code to run when a particular message is received from another micro:bit.
     * {namespace:radio}
     * {weight:79}
     * {help:/functions/on-message-received}
     * {shim:micro_bit::onBroadcastMessageReceived}
     */
    export function onMessageReceived(message: number, body:Action) : void
    {
        /*
        if (message < 0 || message > 65325) {
            TD.simulator.warning("message should be between 0 and 65535.");
        }
        noBleWarning();
        */
    }

    /**
     * Sets the group id for radio communications. A micro:bit can only listen to one group ID at any time.
     * {namespace:radio}
     * {weight:10}
     * {help:/functions/set-group}
     * {shim:micro_bit::setGroup}
     */
    export function setGroup(id: number) : void
    {
        /*
        if (id < 0 || id > 255) {
            TD.simulator.warning("id should be between 0 and 255.");
        }
        noBleWarning();
        */
    }

    /*
    function noBleWarning() : void
    {
        if (TD.simulator.isBleRequired()) {
            TD.simulator.warning("*radio* functions cannot be used with *devices* function or BLE enabled");
        }
    }*/

    /**
     * Broadcasts a number over radio to any connected micro:bit in the group.
     * {help:/functions/send-number}
     * {namespace:radio}
     * {shim:micro_bit::datagramSendNumber}
     */
    export function sendNumber(value: number) : void
    {
//        noBleWarning();
    }

    /**
     * Registers code to run when a packet is received over radio.
     * {namespace:radio}
     * {weight:30}
     * {help:/functions/on-data-received}
     * {shim:micro_bit::onDatagramReceived}
     */
    export function onDataReceived(body:Action) : void
    {
  //      noBleWarning();
    }

    /**
     * Reads the next packet as a number from the radio queue.
     * {help:/functions/receive-number}
     * {weight:20}
     * {namespace:radio}
     * {shim:micro_bit::datagramReceiveNumber}
     */
    export function receiveNumber() : number
    {
        //noBleWarning();
        return 0;
    }

    /**
     * Broadcasts 4 numbers over radio to any connected micro:bit in the group.
     * {help:/functions/send-numbers}
     * {namespace:radio}
     * {shim:micro_bit::datagramSendNumbers}
     */
    export function sendNumbers(value_0: number, value_1: number, value_2: number, value_3: number) : void
    {
//        noBleWarning();
    }

    /**
     * Gets the received signal strength indicator (RSSI) from the packet received by ``receive number``. Not supported in simulator.
     * {namespace:radio}
     * {help:/functions/received-signal-strength}
     * {weight:10}
     * {shim:micro_bit::datagramGetRSSI}
     */
    export function receivedSignalStrength() : number
    {
        return 0;
    }

    /**
     * Reads a number at a given index, between ``0`` and ``3``, from the packet received by ``receive number``. Not supported in simulator.
     * {namespace:radio}
     * {help:/functions/received-number-at}
     * {weight:20}
     * {shim:micro_bit::datagramGetNumber}
     * {hints:index:0,1,2,3}
     */
    export function receivedNumberAt(index: number) : number
    {
  /*      if (index < 0 || index >= 4) {
            TD.simulator.warning("index should be between ``0`` and ``3``.");
        }*/
        return 0;
    }
}