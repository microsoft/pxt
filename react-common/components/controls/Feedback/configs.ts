/// <reference path="../../../../localtypings/ocv.d.ts" />


export const baseConfig: ocv.IFeedbackConfig = {
    feedbackUiType: "NoSurface",
    hostPlatform: "IFrame",
    isDisplayed: true,
    isEmailCollectionEnabled: false,
    isFileUploadEnabled: false,
    isScreenshotEnabled: false,
    isScreenRecordingEnabled: false,
    invokeOnDismissOnEsc: false,
    isFeedbackForumEnabled: false,
    isMyFeedbackEnabled: false,
    isThankYouPageDisabled: false,
}

export const createRatingQuestions = () => {
  return {
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
  }
}


export const ratingFeedbackConfig: ocv.IFeedbackConfig = {
    ...baseConfig,
    initialFeedbackType: "Unclassified",
    scenarioConfig: {
      isScenarioEnabled: true,
      scenarioType: "Custom",
      questionDetails: {
        questionUiType: "Rating",
        ...createRatingQuestions(),
        "questionUiBehaviour": [
          "CommentNotRequired"
        ]
      }
    }
}