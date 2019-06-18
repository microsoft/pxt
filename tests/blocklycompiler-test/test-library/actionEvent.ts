//% color=#0078D7 weight=100
namespace actions {
    //% blockId="event_with_action"
    //% block="event with action $someNumber"
    export function eventWithAnAction(someNumber: number, arg: Action) {

    }

    /**
     * Registers code to run when the radio receives a number.
     */
    //% help=radio/on-received-number blockHandlerKey="radioreceived"
    //% blockId=radio_on_number block="on radio received" blockGap=16
    //% useLoc="radio.onDataPacketReceived"
    export function onReceivedNumber(cb: (receivedNumber: number) => void) {
    }

    export class Packet {
        /**
         * The number payload if a number was sent in this packet (via ``sendNumber()`` or ``sendValue()``)
         * or 0 if this packet did not contain a number.
         */
        public receivedNumber: number;
        /**
         * The string payload if a string was sent in this packet (via ``sendString()`` or ``sendValue()``)
         * or the empty string if this packet did not contain a string.
         */
        public receivedString: string;
        /**
         * The buffer payload if a buffer was sent in this packet
         * or the empty buffer
         */
        // public receivedBuffer: Buffer;
        /**
         * The system time of the sender of the packet at the time the packet was sent.
         */
        public time: number;
        /**
         * The serial number of the sender of the packet or 0 if the sender did not sent their serial number.
         */
        public serial: number;
        /**
         * The received signal strength indicator (RSSI) of the packet.
         */
        public signal: number;
    }

    /**
     * Registers code to run when the radio receives a packet. Also takes the
     * received packet from the radio queue.
     */
    //% help=radio/on-data-packet-received blockHandlerKey="radioreceived" deprecated=true
    //% mutate=objectdestructuring
    //% mutateText=Packet
    //% mutateDefaults="receivedNumber;receivedString:name,receivedNumber:value;receivedString"
    //% blockId=radio_on_packet block="on radio received" blockGap=8
    export function onDataPacketReceived(cb: (packet: Packet) => void) {

    }

    /**
     * Registers code to run when the radio receives a string.
     */
    //% help=radio/on-received-string blockHandlerKey="radioreceived"
    //% blockId=radio_on_string block="on radio received" blockGap=16
    //% useLoc="radio.onDataPacketReceived"
    export function onReceivedString(cb: (receivedString: string) => void) {

    }
}

/**
 * Arguments valid for chat commands
 */
declare const enum ChatArgument {
    number,
    number2,
    string,
    string2
}


namespace player {

    export class ChatCommandArguments {
        public number: number;
        public number2: number;
        public string: string;
        public string2: string;
    }

    /**
     * Runs code when you type a certain message in the game chat
     * @param command the chat keyword that will be associated with this command (``*`` for all messages), eg: "jump"
     */
    //% help=player/on-chat-command
    //% promise
    //% weight=360
    //% blockId=minecraftOnChat block="on chat command %command"
    //% optionalVariableArgs
    //% topblock topblockWeight=95
    export function onChat(command: string, handler: (num1: number, num2: number, num3: number) => void) {
    }


    /**
     * Runs code when you type a certain message in the game chat
     * @param command the chat keyword that will be associated with this command (``*`` for all messages), eg: "jump"
     */
    //% help=player/on-chat-command
    //% promise
    //% weight=350
    //% blockId=minecraftOnChatCommand block="on chat command %command"
    //% mutate=objectdestructuring
    //% mutatePropertyEnum=ChatArgument
    //% mutateText="Command arguments"
    //% mutatePrefix="with"
    //% deprecated=true
    export function onChatCommand(command: string, argTypes: ChatArgument[], handler: (args: ChatCommandArguments) => void): void {
    }
}