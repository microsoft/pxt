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
          displayedString: lf("What did you think of this activity?")
        },
        questionOptions: [
          {
            displayedStringInEnglish: "Boring",
            displayedString: lf("Boring")
          },
          {
            displayedStringInEnglish: "Not fun",
            displayedString: lf("Not fun")
          },
          {
            displayedStringInEnglish: "Kinda fun",
            displayedString: lf("Kinda fun")
          },
          {
            displayedStringInEnglish: "Fun",
            displayedString: lf("Fun")
          },
          {
            displayedStringInEnglish: "Super fun",
            displayedString: lf("Super fun")
          },
        ],
        "questionUiBehaviour": [
          "CommentNotRequired"
        ]
      }
    }
}