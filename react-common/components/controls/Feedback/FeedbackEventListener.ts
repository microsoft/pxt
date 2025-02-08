/// <reference path="../../../../localtypings/ocv.d.ts" />

type FeedbackRequestEventArgsType = FeedbackInitOptionsEventPayload | FeedbackErrorEventPayload | FeedbackInitializationCompleteEventPayload | FeedbackOnSuccessEventPayload | FeedbackDismissWithResultEventPayload;

interface FeedbackInitOptionsEventPayload {
    EventArgs: undefined
}

interface FeedbackErrorEventPayload {
    EventArgs: {
        errorMessage: string
    }
}

interface FeedbackInitializationCompleteEventPayload {
    EventArgs: {
        errorMessages: string[],
        warningMessages: string[],
        status: string
    }
}

interface FeedbackOnSuccessEventPayload {
    EventArgs: {
        clientFeedbackId: string
    }
}

interface FeedbackDismissWithResultEventPayload {
    EventArgs: {
        isSuccess: boolean
    }
}

type FeedbackRequestEventType = 'InAppFeedbackInitOptions' | 'InAppFeedbackOnError' | 'InAppFeedbackInitializationComplete' | 'InAppFeedbackOnSuccess' | 'InAppFeedbackDismissWithResult';

type FeedbackRequestPayloadType = {
    Event: FeedbackRequestEventType
    EventArgs: FeedbackRequestEventArgsType
}

type FeedbackResponseEventType = 'InAppFeedbackInitOptions' | 'OnFeedbackHostAppThemeChanged';

type FeedbackResponseDataType = ocv.IThemeOptions | ocv.IFeedbackInitOptions;

type FeedbackResponsePayloadType = {
  event: FeedbackResponseEventType
  data: FeedbackResponseDataType
}

const defaultTheme = "PublisherLightTheme";
const highContrastTheme = "PublisherDarkTheme";
// for styling the feedback, we use this object. It is mostly used to change the colors.
// we'll want to change this based on the target and whether high contrast is enabled
let themeOptions: ocv.IThemeOptions = {
    baseTheme: defaultTheme,
}

let initfeedbackOptions: ocv.IFeedbackInitOptions;
let feedbackCallbacks: ocv.IFeedbackCallbackFunctions;
let FEEDBACK_FRAME_ID: string;

// the function to initialize the feedback event listener
// feedbackConfig: needs to be passed in as a prop because the things that
/**
 * The function to initialize the feedback event listener
 * @param feedbackConfig: the feedback config object whose fields are defined in OCV.
 *  This changes based on what type of feedback we want to collect. Look at configs.ts for more details.
 * @param frameId: the html id of the actual iframe where the feedback will be displayed
 * @param [callbacks]: an object of functions that can be called when certain events happen in the feedback modal.
 *  Needs to be passed in because the callbacks will depend on what the parent wants to react to.
 */
export const initFeedbackEventListener = (feedbackConfig: ocv.IFeedbackConfig, frameId: string, callbacks?: ocv.IFeedbackCallbackFunctions) => {
    window.addEventListener('message', feedbackCallbackEventListener);
    feedbackCallbacks = callbacks;
    initfeedbackOptions = {
        appId: pxt.appTarget.appTheme.ocvAppId,
        ageGroup: ocv.FeedbackAgeGroup.Undefined,
        authenticationType: ocv.FeedbackAuthenticationType.Unauthenticated,
        clientName: "MakeCode",
        feedbackConfig: feedbackConfig,
        isProduction: false,
        themeOptions: themeOptions,
        // telemetry - will likely want this
    }
    FEEDBACK_FRAME_ID = frameId;
}

export const removeFeedbackEventListener = () => {
    window.removeEventListener('message', feedbackCallbackEventListener);
}

/**
 * The function that listens for the feedback events.
 * The events here are the ones that seemed most useful to log or respond to
 * @param event: the event received from OCV
 */
const feedbackCallbackEventListener = (event: MessageEvent<FeedbackRequestPayloadType>) => {
    if (event.data.Event) {
        const payload: FeedbackRequestPayloadType = event.data
        switch (payload.Event) {
            case 'InAppFeedbackInitOptions': //This is required to initialise feedback
                sendFeedbackInitOptions()
                break
            case 'InAppFeedbackOnError': //Invoked when an error occurrs on feedback submission - would be nice to log something to the user
                pxt.warn('Error Message: ', payload.EventArgs)
                break
            case 'InAppFeedbackInitializationComplete': //Invoked when feedback form is fully initialised and displays error/warning if any - nice to have a log for this
                pxt.debug('InAppFeedbackInitializationComplete: ', payload.EventArgs)
                break
            case 'InAppFeedbackOnSuccess': //Invoked when feedback submission is successful - would be useful to have telemetry/something else on this event
                pxt.debug('InAppFeedbackOnSuccess: ', payload.EventArgs)
                break
            case 'InAppFeedbackDismissWithResult': //Invoked when feedback is dismissed - the big important one for us to be able to close the feedback modal
                pxt.debug('InAppFeedbackDismissWithResult: ', payload.EventArgs);
                feedbackCallbacks?.onDismiss?.();
                break
        }
    }
}

// ***************** Helper Functions *****************

const getIFrameAndSend = (payload: FeedbackResponsePayloadType) => {
    const iFrameElement = document.getElementById(FEEDBACK_FRAME_ID) as HTMLIFrameElement
    if (iFrameElement) {
        iFrameElement.contentWindow!.postMessage(payload, pxt.appTarget.appTheme.ocvFrameUrl);
    }
}
// TODO
// haven't implemented yet with events, but this will be needed in order to update to high contrast
// general changes need to be made as well use the correct theme. the windows ones were just the defaults.
export const sendUpdateFeedbackTheme = (highContrastOn: boolean) => {
    let currentTheme = themeOptions.baseTheme;
    if (currentTheme === defaultTheme && highContrastOn) {
        currentTheme = highContrastTheme;
    } else if (currentTheme === highContrastTheme && !highContrastOn) {
        currentTheme = defaultTheme;
    }
    const response: FeedbackResponsePayloadType = {
        event: 'OnFeedbackHostAppThemeChanged',
        data: {
            baseTheme: currentTheme
        },
    }
    themeOptions.baseTheme = currentTheme;
    getIFrameAndSend(response);
}


/**
 * Actually initializes the feedback session. This is called when the feedback modal opens.
 */
const sendFeedbackInitOptions = () => {
    let response: FeedbackResponsePayloadType = {
        event: 'InAppFeedbackInitOptions',
        data: initfeedbackOptions,
    }
    getIFrameAndSend(response);
}