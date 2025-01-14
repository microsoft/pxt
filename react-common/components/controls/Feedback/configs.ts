export const baseConfig: any = {
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
    isThankYouPageDisabled: false,
}

export const ratingFeedbackConfig: any = {
    ...baseConfig,
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