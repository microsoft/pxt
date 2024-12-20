import { useEffect } from "react"

export const feedbackConfig: any = {
    feedbackUiType: "NoSurface",
    hostPlatform: "IFrame",
    isDisplayed: true,
    isEmailCollectionEnabled: false, // to enable email collection
    isFileUploadEnabled: false, // to enable file upload function
    isScreenshotEnabled: false, // to enable screenshot
    isScreenRecordingEnabled: false, // to enable screen recording
    invokeOnDismissOnEsc: false,
    isFeedbackForumEnabled: false,
    isMyFeedbackEnabled: false,
    isThankYouPageDisabled: true,
    initialFeedbackType: "Unclassified",
    scenarioConfig: {
      isScenarioEnabled: true,
      scenarioType: "Custom",
      questionDetails: {
        questionUiType: "Rating",
        questionInstruction: {
          displayedStringInEnglish: "This is a custom Rating Question",
          displayedString: "This is a custom Rating Question"
        },
        questionOptions: [
          {
            displayedStringInEnglish: "Option 1",
            displayedString: "Option 1"
          },
          {
            displayedStringInEnglish: "Option 2",
            displayedString: "Option 2"
          },
          {
            displayedStringInEnglish: "Option 3",
            displayedString: "Option 3"
          },
          {
            displayedStringInEnglish: "Option 4",
            displayedString: "Option 4"
          },
          {
            displayedStringInEnglish: "Option 5",
            displayedString: "Option 5"
          }
        ]
      }
    }
}

export const themeOptions = {
    baseTheme: "PublisherLightTheme",
}

export const initfeedbackOptions: any = {
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
export interface FeedbackRequestEventPayload<T> {
  Event: string
  EventArgs: string
}
type FeedbackRequestPayloadType = FeedbackRequestEventPayload<any>

export interface FeedbackResponseEventPayload<T> {
  event: string
  data: T
  error?: any
}

export const FEEDBACK_FRAME_ID = 'feedback-iframe'

let feedbackData = initfeedbackOptions

export const feedbackCallbackEventListener = (event: MessageEvent<FeedbackRequestPayloadType>) => {
  if (event.data.Event) {
    console.log("we got an event with data");
    const payload: FeedbackRequestPayloadType = event.data
    switch (payload.Event) {
      case 'InAppFeedbackInitOptions': //This is required to initialise feedback
        sendFeedbackInitOptions()
        break
    //   case 'InAppFeedbackScreenshot': //This is only needed if you want to have screenshot dynamically provided by host
    //     sendInAppFeedbackScreenshot()
    //     break
      case 'InAppFeedbackOnError': //Invoked when an error occurrs on feedback submission
        console.log('Error Message: ', payload.EventArgs)
        break
      case 'InAppFeedbackAttachDiagnosticLogs': //Invoked when submit button is clicked and feedbackData.feedbackConfig.diagnosticsConfig is configured
        console.log('Host App can send diagnostics to a third party app data using', payload.EventArgs)
        break
    //   case 'InAppFeedbackGetContextData': //This is needed if you want to pass in content samples to be displayed on the form
    //     sendInAppFeedbackGetContextData()
    //     break
      case 'InAppFeedbackSetCurrentPage': //To follow the feedback Page number
        console.log('pageName: ', payload.EventArgs)
        break
      case 'InAppFeedbackSetSubmitButtonState': //To follow the feedback Submit Button State
        console.log('submitState: ', payload.EventArgs)
        break
      case 'InAppFeedbackInitializationComplete': //Invoked when feedback form is fully initialised and displays error/warning if any
        console.log('InAppFeedbackInitializationComplete: ', payload.EventArgs)
        break
      case 'InAppFeedbackOnSuccess': //Invoked when feedback submission is successful
        console.log('InAppFeedbackOnSuccess: ', payload.EventArgs)
        break
      case 'InAppFeedbackDismissWithResult': //Invoked when feedback is dismissed
        console.log('InAppFeedbackDismissWithResult: ', payload.EventArgs)
        break
      case 'InAppFeedbackExtractFeedbackDataForHost': //Invoked when feedback is dismissed
        console.log('InAppFeedbackExtractFeedbackDataForHost: ', payload.EventArgs)
        break
    }
  }
}

let currentTheme = ''

export const sendUpdateTheme = () => {
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
  console.log("HELLOOOOOO")
  console.log(feedbackData)
  console.log("got the message to init");
  let response: FeedbackResponsePayloadType = {
    event: 'InAppFeedbackInitOptions',
    data: feedbackData,
  }
  response = JSON.parse(JSON.stringify(response))
  const iFrameEle = document.getElementById(FEEDBACK_FRAME_ID) as HTMLIFrameElement
  iFrameEle!.contentWindow!.postMessage(response, 'https://admin-ignite.microsoft.com')
}

export const Feedback = () => {
    const appId = 50315;

    useEffect(() => {
        window.addEventListener('message', feedbackCallbackEventListener)
        return () => {
            window.removeEventListener('message', feedbackCallbackEventListener)
        }
    }, [])
    return (
        <iframe
        title="feedback-demo"
        height="450px" // You can change this according to your host app requirement
        width="700px"  // You can change this according to your host app requirement
        id={FEEDBACK_FRAME_ID}
        src={`https://admin-ignite.microsoft.com/centrohost?appname=ocvfeedback&feature=host-ocv-inapp-feedback&platform=web&appId=${appId}#/hostedpage`}
        allow="display-capture;" // This is needed if you want to use the native screenshot/screen recording feature
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups" />  
    )
}