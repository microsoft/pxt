declare namespace ocv {

    type FeedbackKind = "generic" | "rating";

    type FeedbackAgeGroup =
        | "Undefined"
        | "MinorWithoutParentalConsent"
        | "MinorWithParentalConsent"
        | "NotAdult"
        | "Adult"
        | "MinorNoParentalConsentRequired";
    
    interface IFeedbackCallbackFunctions {
        attachDiagnosticsLogs?: (diagnosticsUploadId: string, diagnosticsEndpoint: string) => void;
        onDismiss?: (isFeedbackSent?: boolean) => void;
        onSuccess?: (clientFeedbackId: string) => void;
        onError?: (errorMessage?: string) => void;
        supportCallback?: () => void;
        initializationComplete?: (initializationCompleteResult: InitializationResult) => void;
        setSubmitButtonState?: (isEnabled: boolean) => void;
    }
    

    type FeedbackAuthenticationType = "MSA" | "AAD" | "Unauthenticated";

    type FeedbackType = "Smile" | "Frown" | "Idea" | "Unclassified" | "Survey";

    type FeedbackPolicyValue = "Enabled" | "Disabled" | "Not Configured" | "Not Applicable";
    
    interface IThemeOptions {
        isFluentV9?: boolean;
        /**
         * v9Theme must be Theme object from @fluentui/react-components@9.*
         */
        v9Theme?: any;
        /**
         * brandVariants must be BrandVariants object from @fluentui/react-components@9.*
         */
        brandVariants?: any;
        baseTheme?: any;
        colorScheme?: any;
    }
    
    interface IFeedbackInitOptions {
        ageGroup?: FeedbackAgeGroup;
        appId?: number;
        authenticationType?: FeedbackAuthenticationType;
        callbackFunctions?: IFeedbackCallbackFunctions;
        clientName?: string;
        feedbackConfig?: IFeedbackConfig;
        isProduction?: boolean;
        telemetry?: IFeedbackTelemetry;
        themeOptions?: IThemeOptions;
    }
    
    type FeedbackUiType =
        | "SidePane"
        | "Modal"
        | "CallOut"
        | "IFrameWithinSidePane"
        | "IFrameWithinModal"
        | "IFrameWithinCallOut"
        | "NoSurface"
        | "NoSurfaceWithoutTitle";


    type FeedbackHostPlatformType =
        | "Windows"
        | "iOS"
        | "Android"
        | "WacTaskPane"
        | "MacOS"
        | "Web"
        | "IFrame";

    type FeedbackHostEventName = "InAppFeedback_HostEvent_SubmitClicked" | "InAppFeedback_HostEvent_BackClicked";

    type InitializationStatus = "Success" | "Error" | "Warning";

    type InAppFeedbackQuestionUiType =
        | "DropDown"
        | "MultiSelect"
        | "Rating"
        | "SingleSelect"
        | "SingleSelectHorizontal";
    
    type InAppFeedbackScenarioType =
        | "FeatureArea"
        | "ResponsibleAI"
        | "Experience"
        | "ProductSatisfaction"
        | "CrashImpact"
        | "Custom"
        | "AIThumbsDown"
        | "AIThumbsUp"
        | "AIError"
        | "PromptSuggestion";

    type InAppFeedbackQuestionUiBehaviour =
        | "QuestionNotRequired"
        | "CommentNotRequired"
        | "CommentRequiredWithLastOption";

    type FeedbackAttachmentOrigin = "Application" | "User";

    type FeedbackEntryPoint =
        | "Header"
        | "Footer"
        | "Backstage"
        | "Help Menu"
        | "Canvas"
        | "Chat";
    interface InitializationResult {
        status: InitializationStatus;
        /**
         * in UTC timestamp milliseconds
         */
        timestamp?: number;
        /**
         * Duration to load package and validations (centro performance) in milliseconds
         */
        loadTime?: number;
        errorMessages?: string[];
        warningMessages?: string[];
    }
    
    interface IFeedbackConfig {
        appData?: string;
        canDisplayFeedbackCalled?: boolean;
        feedbackUiType?: FeedbackUiType;
        hideFooterActionButtons?: boolean;
        initialFeedbackType?: FeedbackType;
        hostPlatform?: FeedbackHostPlatformType;
        /**
         * Invokes onDismiss callback on Esc button press
         * Useful for host apps like Win32 Pane or iFrames
         */
        invokeOnDismissOnEsc?: boolean;
        isDisplayed?: boolean;
        isEmailCollectionEnabled?: boolean;
        isFeedbackForumEnabled?: boolean;
        isFileUploadEnabled?: boolean;
        isMyFeedbackEnabled?: boolean;
        isScreenRecordingEnabled?: boolean;
        isScreenshotEnabled?: boolean;
        isShareContextDataEnabled?: boolean;
        isThankYouPageDisabled?: boolean;
        isSupportEnabled?: boolean;
        maxHeight?: number;
        maxWidth?: number;
        minHeight?: number;
        minWidth?: number;
        myFeedbackUrl?: string;
        privacyUrl?: string;
        retentionDurationDays?: number;
        scenarioConfig?: InAppFeedbackScenarioConfig;
        supportUrl?: string;
        /**
         * Enable submit offline feedback
         * This will only work if submitOffline callback is provided
         */
        isOfflineSubmitEnabled?: boolean;
        /**
         * For platforms that host other products or sites, this parameter is used to disambiguate the recipient of the data.
         * Its effect is to alter the form title for internal users only, replacing 'Microsoft' with the string provided.
         * The string length is capped at 30 characters.
         * Please keep the name as short as possible to optimize the user experience, preferably including only the product name.
         * */
        msInternalTitleTarget?: string;
    }
    
    type IFeedbackTelemetry = {
        accountCountryCode?: string;
        affectedProcessSessionId?: string;
        appVersion?: string;
        audience?: string;
        audienceGroup?: string;
        browser?: string;
        browserVersion?: string;
        channel?: string;
        clientCountryCode?: string;
        cpuModel?: string;
        dataCenter?: string;
        deviceId?: string;
        deviceType?: string;
        entryPoint?: FeedbackEntryPoint;
        errorClassification?: string;
        errorCode?: string;
        errorName?: string;
        featureArea?: string;
        featureName?: string;
        feedbackOrigin?: string;
        flights?: string;
        flightSource?: string;
        fundamentalArea?: string;
        installationType?: string;
        isLogIncluded?: boolean;
        isUserSubscriber?: boolean;
        officeArchitecture?: string;
        officeBuild?: string;
        officeEditingLang?: number;
        officeUILang?: number;
        osBitness?: number;
        osBuild?: string;
        osUserLang?: number;
        platform?: string;
        processorArchitecture?: string;
        processorPhysicalCores?: number;
        processSessionId?: string;
        ringId?: number;
        sku?: string;
        sourceContext?: string;
        sqmMachineId?: string;
        subFeatureName?: string;
        sourcePageName?: string;
        sourcePageURI?: string;
        systemManufacturer?: string;
        systemProductName?: string;
        uiHost?: string;
    };
    
    interface InAppFeedbackScenarioConfig {
        isScenarioEnabled?: boolean;
        scenarioType?: InAppFeedbackScenarioType;
        questionDetails?: InAppFeedbackQuestion;
    }

    interface InAppFeedbackQuestion {
        questionUiType?: InAppFeedbackQuestionUiType;
        questionInstruction?: InAppFeedbackCompositeString;
        questionOptions?: InAppFeedbackCompositeString[];
        questionUiBehaviour?: InAppFeedbackQuestionUiBehaviour[];
    }

    interface InAppFeedbackCompositeString {
        displayedString: string;
        displayedStringInEnglish: string;
    }
}




