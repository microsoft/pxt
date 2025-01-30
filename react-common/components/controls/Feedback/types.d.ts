export declare enum FeedbackAgeGroup {
    Undefined = "Undefined",
    MinorWithoutParentalConsent = "MinorWithoutParentalConsent",
    MinorWithParentalConsent = "MinorWithParentalConsent",
    NotAdult = "NotAdult",
    Adult = "Adult",
    MinorNoParentalConsentRequired = "MinorNoParentalConsentRequired"
}

export interface IFeedbackCallbackFunctions {
    attachDiagnosticsLogs?: (diagnosticsUploadId: string, diagnosticsEndpoint: string) => void;
    onDismiss?: (isFeedbackSent?: boolean) => void;
    onSuccess?: (clientFeedbackId: string) => void;
    onError?: (errorMessage?: string) => void;
    supportCallback?: () => void;
    initializationComplete?: (initializationCompleteResult: InitializationResult) => void;
    submitOffline?: (processedOfflineFeedback: ProcessedOfflineFeedback) => void;
    setCurrentPage?: (pageName: InAppFeedbackPageName) => void;
    setSubmitButtonState?: (isEnabled: boolean) => void;
    onResize?: (feedbackContainerDimension: InAppFeedbackContainerDimension) => void;
    /**
     * This callback is called for each downstream service request that requires a user access token.
     * An implementation of this callback should have a switch on `UserAccessTokenAudience` for each service that have been configured by the client.
     * E.g. see `tenantFeedbackServiceOptions`
     *
     * @param audience the service for which the token is requested
     * @param userUpn the user on behalf of whom the token is requested
     * @returns an `IUserAccessTokenInfo` with the token and additional relevant metadata needed for the downstream request
     */
    getUserAccessToken?: (audience: UserAccessTokenAudience, userUpn: string) => Promise<IUserAccessTokenInfo | string | undefined>;
}

export declare enum FeedbackAuthenticationType {
    MSA = "MSA",
    AAD = "AAD",
    Unauthenticated = "Unauthenticated"
}
export declare enum FeedbackPolicyValue {
    Enabled = "Enabled",
    Disabled = "Disabled",
    NotConfigured = "Not Configured",
    /**
     * For feedback applications outside of M366, OCPS policies do not currently apply. This value
     * is an explicit indication of that condition. In other words, this value should not be used unless
     * the integrating partner is not part of M365 and knows that OCPS policies do not apply.
     */
    NotApplicable = "Not Applicable"
}

export interface IThemeOptions {
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

export interface IFeedbackInitOptions {
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

export declare enum FeedbackUiType {
    SidePane = "SidePane",// Default: Used for side pane/detail view
    Modal = "Modal",// Used for modal view
    CallOut = "CallOut",// Used for inscreen pop up dialogue
    IFrameWithinSidePane = "IFrameWithinSidePane",// Same as side pane but used inside an iframe
    IFrameWithinModal = "IFrameWithinModal",// Same as modal but used inside an iframe
    IFrameWithinCallOut = "IFrameWithinCallOut",// Same as callout but used inside an iframe
    NoSurface = "NoSurface",// Used when the surface is provided by the host app
    NoSurfaceWithoutTitle = "NoSurfaceWithoutTitle"
}

export declare enum FeedbackHostPlatformType {
    Windows = "Windows",
    IOS = "iOS",
    Android = "Android",
    WacTaskPane = "WacTaskPane",
    MacOS = "MacOS",
    Web = "Web",
    IFrame = "IFrame"
}
export declare enum FeedbackHostEventName {
    SubmitClicked = "InAppFeedback_HostEvent_SubmitClicked",
    BackClicked = "InAppFeedback_HostEvent_BackClicked"
}
export declare enum InitializationStatus {
    Success = "Success",
    Error = "Error",
    Warning = "Warning"
}
export declare enum InAppFeedbackQuestionUiType {
    DropDown = "DropDown",
    MultiSelect = "MultiSelect",
    Rating = "Rating",
    SingleSelect = "SingleSelect",
    SingleSelectHorizontal = "SingleSelectHorizontal"
}

export declare enum InAppFeedbackScenarioType {
    FeatureArea = "FeatureArea",
    ResponsibleAI = "ResponsibleAI",
    Experience = "Experience",
    ProductSatisfaction = "ProductSatisfaction",
    CrashImpact = "CrashImpact",// CrashImpact is of type Survey
    Custom = "Custom",
    AIThumbsDown = "AIThumbsDown",
    AIThumbsUp = "AIThumbsUp",
    AIError = "AIError",
    PromptSuggestion = "PromptSuggestion"
}
export declare enum InAppFeedbackQuestionUiBehaviour {
    QuestionNotRequired = "QuestionNotRequired",
    CommentNotRequired = "CommentNotRequired",
    CommentRequiredWithLastOption = "CommentRequiredWithLastOption"
}
export declare enum FeedbackAttachmentOrigin {
    Application = "Application",
    User = "User"
}
export declare enum FeedbackEntryPoint {
    Header = "Header",
    Footer = "Footer",
    Backstage = "Backstage",
    HelpMenu = "Help Menu",
    Canvas = "Canvas",
    Chat = "Chat"
}

export interface InitializationResult {
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

export interface IFeedbackConfig {
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

export type IFeedbackTelemetry = {
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
    integrationSource?: FeedbackIntegrationSource;
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

export interface InAppFeedbackScenarioConfig {
    isScenarioEnabled?: boolean;
    scenarioType?: InAppFeedbackScenarioType;
    questionDetails?: InAppFeedbackQuestion;
}
export interface InAppFeedbackQuestion {
    questionUiType?: InAppFeedbackQuestionUiType;
    questionInstruction?: InAppFeedbackCompositeString;
    questionOptions?: InAppFeedbackCompositeString[];
    questionUiBehaviour?: InAppFeedbackQuestionUiBehaviour[];
}
export interface InAppFeedbackCompositeString {
    displayedString: string;
    displayedStringInEnglish: string;
}



