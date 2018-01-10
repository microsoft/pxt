declare namespace mscc {
    /**
    * The current mscc cookie name
    */
    const cookieName: string;

    /**
    * The current mscc version
    */
    const version: string;

    /**
    * If true, consent will automatically be given by the user via
    * interacting with the site. When enabled, MSCC will listen for click
    * events on the current page, setting consent if the user clicks.
    *
    * @default: true
    */
    let interactiveConsentEnabled: boolean;

    /**
    * The valid event types that can be subscribed to
    */
    type EventTypes = 'consent';

    /**
    * The subscriber method as part of mscc's pubsub model.
    *
    * @param name - the name of the event to be subscribed to
    * @param fn - the function to call after the event is published
    */
    function on(name: EventTypes, fn: Function): void;

    /**
    * Set hasConsent to true, and set the consent cookie. If the mscc cookie banner is
    * present on the page, the banner will be closed. Is idempotent.
    */
    function setConsent(): void;

    /**
    * Returns true if the user has given consent, otherwise false.
    */
    function hasConsent(): boolean;
}