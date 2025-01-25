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

let themeOptions = { // will want to change this based on the target where we live
    baseTheme: "PublisherLightTheme",
}

let initfeedbackOptions: any;
let feedbackData: any;
let FEEDBACK_FRAME_ID: string;
let currentTheme = '';
let feedbackCallbacks: any;

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
        // userId
        // userData
    
    }

    feedbackData = initfeedbackOptions;
    FEEDBACK_FRAME_ID = frameId;
}

export const removeFeedbackEventListener = () => {
    window.removeEventListener('message', feedbackCallbackEventListener);
}

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


const sendUpdateTheme = () => { // want to be able to do this, but will wait on this.
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

//private functions
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