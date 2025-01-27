export const appId = 50315;
export const feedbackFrameUrl = 'https://admin-ignite.microsoft.com';

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
          displayedStringInEnglish: "What did you think of this activity?",
          displayedString: "What did you think of this activity?"
        },
        questionOptions: [
          {
            displayedStringInEnglish: "Boring",
            displayedString: "Boring"
          },
          {
            displayedStringInEnglish: "Not fun",
            displayedString: "Not fun"
          },
          {
            displayedStringInEnglish: "Kinda fun",
            displayedString: "Kinda fun"
          },
          {
            displayedStringInEnglish: "Fun",
            displayedString: "Fun"
          },
          {
            displayedStringInEnglish: "Super fun",
            displayedString: "Super fun"
          },
        ],
        "questionUiBehaviour": [
          "CommentNotRequired"
        ]
      }
    }
}