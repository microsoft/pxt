import { FeedbackHostPlatformType, FeedbackUiType, IFeedbackConfig, InAppFeedbackQuestionUiBehaviour, InAppFeedbackQuestionUiType, InAppFeedbackScenarioType } from "./types";

export const appId = 50315;
export const feedbackFrameUrl = 'https://admin-ignite.microsoft.com';

export const baseConfig: IFeedbackConfig = {
    feedbackUiType: FeedbackUiType.NoSurface,
    hostPlatform: FeedbackHostPlatformType.IFrame,
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

export const ratingFeedbackConfig: IFeedbackConfig = {
    ...baseConfig,
    initialFeedbackType: "Unclassified",
    scenarioConfig: {
      isScenarioEnabled: true,
      scenarioType: InAppFeedbackScenarioType.Custom,
      questionDetails: {
        questionUiType: InAppFeedbackQuestionUiType.Rating,
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
          InAppFeedbackQuestionUiBehaviour.CommentNotRequired
        ]
      }
    }
}