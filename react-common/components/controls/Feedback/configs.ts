/// <reference path="../../../../localtypings/ocv.d.ts" />

export const appId = 50315;
export const feedbackFrameUrl = 'https://admin-ignite.microsoft.com';

export const baseConfig: ocv.IFeedbackConfig = {
    feedbackUiType: ocv.FeedbackUiType.NoSurface,
    hostPlatform: ocv.FeedbackHostPlatformType.IFrame,
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
    initialFeedbackType: ocv.FeedbackType.Unclassified,
    scenarioConfig: {
      isScenarioEnabled: true,
      scenarioType: ocv.InAppFeedbackScenarioType.Custom,
      questionDetails: {
        questionUiType: ocv.InAppFeedbackQuestionUiType.Rating,
        ...createRatingQuestions(),
        "questionUiBehaviour": [
          ocv.InAppFeedbackQuestionUiBehaviour.CommentNotRequired
        ]
      }
    }
}