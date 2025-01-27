interface FeedbackRequestEventPayload<T> {
  Event: string
  EventArgs: string
}
type FeedbackRequestPayloadType = FeedbackRequestEventPayload<any>

interface FeedbackResponseEventPayload<T> {
  event: string
  data: T
  error?: any
}

// for styling the feedback, we use this object. It is mostly used to change the colors.
// we'll want to change this based on the target where we live
let themeOptions = {
    baseTheme: "PublisherLightTheme",
}

let initfeedbackOptions: any;
let feedbackData: any;
let FEEDBACK_FRAME_ID: string;
let currentTheme = '';
let feedbackCallbacks: any;

// the function to initialize the feedback event listener
// feedbackConfig: needs to be passed in as a prop because the things that
/**
 * The function to initialize the feedback event listener
 * @param {any} feedbackConfig: the feedback config object whose fields are defined in OCV.
 *  This changes based on what type of feedback we want to collect. Look at configs.ts for more details.
 * @param {string} frameId: the html id of the actual iframe where the feedback will be displayed
 * @param {any} [callbacks]: an object of functions that can be called when certain events happen in the feedback modal.
 *  Needs to be passed in because the callbacks will depend on what the parent wants to react to.
 */
export const initFeedbackEventListener = (feedbackConfig: any, frameId: string, callbacks?: any) => {
    window.addEventListener('message', feedbackCallbackEventListener);
    feedbackCallbacks = callbacks;
    initfeedbackOptions = {
        appId: 50315,
        ageGroup: "Undefined",
        authenticationType: "Unauthenticated",
        clientName: "MakeCode",
        feedbackConfig: feedbackConfig,
        isProduction: false,
        themeOptions: themeOptions,
        // telemetry - will likely want this
    }

    feedbackData = initfeedbackOptions;
    FEEDBACK_FRAME_ID = frameId;
}

export const removeFeedbackEventListener = () => {
    window.removeEventListener('message', feedbackCallbackEventListener);
}

/**
 * The function that listens for the feedback events.
 * The events here are the ones that seemed most useful to log or respond to
 * @param {MessageEvent<FeedbackRequestPayloadType>} event: the event received from OCV
 */
const feedbackCallbackEventListener = (event: MessageEvent<FeedbackRequestPayloadType>) => {
if (event.data.Event) {
    const payload: FeedbackRequestPayloadType = event.data
    switch (payload.Event) {
    case 'InAppFeedbackInitOptions': //This is required to initialise feedback
        sendFeedbackInitOptions()
        break
    case 'InAppFeedbackOnError': //Invoked when an error occurrs on feedback submission - would be nice to log something to the user
        console.log('Error Message: ', payload.EventArgs)
        break
    case 'InAppFeedbackInitializationComplete': //Invoked when feedback form is fully initialised and displays error/warning if any - nice to have a log for this
        console.log('InAppFeedbackInitializationComplete: ', payload.EventArgs)
        break
    case 'InAppFeedbackOnSuccess': //Invoked when feedback submission is successful - would be useful to have telemetry/something else on this event
        console.log('InAppFeedbackOnSuccess: ', payload.EventArgs)
        break
    case 'InAppFeedbackDismissWithResult': //Invoked when feedback is dismissed - the big important one for us to be able to close the feedback modal
        console.log('InAppFeedbackDismissWithResult: ', payload.EventArgs);
        if (feedbackCallbacks.onDismiss) {
            feedbackCallbacks.onDismiss();
        }
        break
    }
}
}

// ***************** Helper Functions *****************

// TODO
// haven't implemented yet with events, but this will be needed in order to update to high contrast
// general changes need to be made as well use the correct theme. the windows ones were just the defaults.
const sendUpdateTheme = () => {
    type FeedbackResponsePayloadType = FeedbackResponseEventPayload<any>
    if (currentTheme == 'WindowsDark') {
        currentTheme = 'WindowsLight'
    } else {
        currentTheme = 'WindowsDark'
    }
    const response: FeedbackResponsePayloadType = {
        event: 'OnFeedbackHostAppThemeChanged',
        data: {
            baseTheme: currentTheme,
        },
    }
    const iFrameEle = document.getElementById(FEEDBACK_FRAME_ID) as HTMLIFrameElement
    iFrameEle!.contentWindow!.postMessage(response, 'https://admin-ignite.microsoft.com')
}


/**
 * Actually initializes the feedback session. This is called when the feedback modal opens.
 */
const sendFeedbackInitOptions = () => {
    type FeedbackResponsePayloadType = FeedbackResponseEventPayload<any>
    feedbackData.callbackFunctions = undefined
    //   feedbackData.feedbackConfig!.diagnosticsConfig!.attachDiagnostics = undefined
    let response: FeedbackResponsePayloadType = {
        event: 'InAppFeedbackInitOptions',
        data: feedbackData,
    }
    response = JSON.parse(JSON.stringify(response))
    const iFrameEle = document.getElementById(FEEDBACK_FRAME_ID) as HTMLIFrameElement
    iFrameEle!.contentWindow!.postMessage(response, 'https://admin-ignite.microsoft.com')
}