declare module Microsoft.ApplicationInsights {
    enum LoggingSeverity {
        /**
         * Error will be sent as internal telemetry
         */
        CRITICAL = 0,
        /**
         * Error will NOT be sent as internal telemetry, and will only be shown in browser console
         */
        WARNING = 1,
    }
    /**
     * Internal message ID. Please create a new one for every conceptually different message. Please keep alphabetically ordered
     */
    enum _InternalMessageId {
        NONUSRACT_BrowserDoesNotSupportLocalStorage = 0,
        NONUSRACT_BrowserCannotReadLocalStorage = 1,
        NONUSRACT_BrowserCannotReadSessionStorage = 2,
        NONUSRACT_BrowserCannotWriteLocalStorage = 3,
        NONUSRACT_BrowserCannotWriteSessionStorage = 4,
        NONUSRACT_BrowserFailedRemovalFromLocalStorage = 5,
        NONUSRACT_BrowserFailedRemovalFromSessionStorage = 6,
        NONUSRACT_CannotSendEmptyTelemetry = 7,
        NONUSRACT_ClientPerformanceMathError = 8,
        NONUSRACT_ErrorParsingAISessionCookie = 9,
        NONUSRACT_ErrorPVCalc = 10,
        NONUSRACT_ExceptionWhileLoggingError = 11,
        NONUSRACT_FailedAddingTelemetryToBuffer = 12,
        NONUSRACT_FailedMonitorAjaxAbort = 13,
        NONUSRACT_FailedMonitorAjaxDur = 14,
        NONUSRACT_FailedMonitorAjaxOpen = 15,
        NONUSRACT_FailedMonitorAjaxRSC = 16,
        NONUSRACT_FailedMonitorAjaxSend = 17,
        NONUSRACT_FailedToAddHandlerForOnBeforeUnload = 18,
        NONUSRACT_FailedToSendQueuedTelemetry = 19,
        NONUSRACT_FailedToReportDataLoss = 20,
        NONUSRACT_FlushFailed = 21,
        NONUSRACT_MessageLimitPerPVExceeded = 22,
        NONUSRACT_MissingRequiredFieldSpecification = 23,
        NONUSRACT_NavigationTimingNotSupported = 24,
        NONUSRACT_OnError = 25,
        NONUSRACT_SessionRenewalDateIsZero = 26,
        NONUSRACT_SenderNotInitialized = 27,
        NONUSRACT_StartTrackEventFailed = 28,
        NONUSRACT_StopTrackEventFailed = 29,
        NONUSRACT_StartTrackFailed = 30,
        NONUSRACT_StopTrackFailed = 31,
        NONUSRACT_TelemetrySampledAndNotSent = 32,
        NONUSRACT_TrackEventFailed = 33,
        NONUSRACT_TrackExceptionFailed = 34,
        NONUSRACT_TrackMetricFailed = 35,
        NONUSRACT_TrackPVFailed = 36,
        NONUSRACT_TrackPVFailedCalc = 37,
        NONUSRACT_TrackTraceFailed = 38,
        NONUSRACT_TransmissionFailed = 39,
        NONUSRACT_FailedToSetStorageBuffer = 40,
        NONUSRACT_FailedToRestoreStorageBuffer = 41,
        NONUSRACT_InvalidBackendResponse = 42,
        USRACT_CannotSerializeObject = 43,
        USRACT_CannotSerializeObjectNonSerializable = 44,
        USRACT_CircularReferenceDetected = 45,
        USRACT_ClearAuthContextFailed = 46,
        USRACT_ExceptionTruncated = 47,
        USRACT_IllegalCharsInName = 48,
        USRACT_ItemNotInArray = 49,
        USRACT_MaxAjaxPerPVExceeded = 50,
        USRACT_MessageTruncated = 51,
        USRACT_NameTooLong = 52,
        USRACT_SampleRateOutOfRange = 53,
        USRACT_SetAuthContextFailed = 54,
        USRACT_SetAuthContextFailedAccountName = 55,
        USRACT_StringValueTooLong = 56,
        USRACT_StartCalledMoreThanOnce = 57,
        USRACT_StopCalledWithoutStart = 58,
        USRACT_TelemetryInitializerFailed = 59,
        USRACT_TrackArgumentsNotSpecified = 60,
        USRACT_UrlTooLong = 61,
        USRACT_SessionStorageBufferFull = 62,
        USRACT_CannotAccessCookie = 63,
    }
    class _InternalLogMessage {
        message: string;
        messageId: _InternalMessageId;
        constructor(msgId: _InternalMessageId, msg: string, properties?: Object);
        private static sanitizeDiagnosticText(text);
    }
    class _InternalLogging {
        /**
         * Prefix of the traces in portal.
         */
        private static AiUserActionablePrefix;
        /**
        *  Session storage key for the prefix for the key indicating message type already logged
        */
        private static AIInternalMessagePrefix;
        /**
         * For user non actionable traces use AI Internal prefix.
         */
        private static AiNonUserActionablePrefix;
        /**
         * When this is true the SDK will throw exceptions to aid in debugging.
         */
        static enableDebugExceptions: () => boolean;
        /**
         * When this is true the SDK will log more messages to aid in debugging.
         */
        static verboseLogging: () => boolean;
        /**
         * The internal logging queue
         */
        static queue: any[];
        /**
         * The maximum number of internal messages allowed to be sent per page view
         */
        private static MAX_INTERNAL_MESSAGE_LIMIT;
        /**
         * Count of internal messages sent
         */
        private static _messageCount;
        /**
         * Holds information about what message types were already logged to console or sent to server.
         */
        private static _messageLogged;
        /**
         * This method will throw exceptions in debug mode or attempt to log the error as a console warning.
         * @param severity {LoggingSeverity} - The severity of the log message
         * @param message {_InternalLogMessage} - The log message.
         */
        static throwInternalNonUserActionable(severity: LoggingSeverity, message: _InternalLogMessage): void;
        /**
         * This method will throw exceptions in debug mode or attempt to log the error as a console warning.
         * @param severity {LoggingSeverity} - The severity of the log message
         * @param message {_InternalLogMessage} - The log message.
         */
        static throwInternalUserActionable(severity: LoggingSeverity, message: _InternalLogMessage): void;
        /**
         * This will write a warning to the console if possible
         * @param message {string} - The warning message
         */
        static warnToConsole(message: string): void;
        /**
         * Resets the internal message count
         */
        static resetInternalMessageCount(): void;
        /**
         * Clears the list of records indicating that internal message type was already logged
         */
        static clearInternalMessageLoggedTypes(): void;
        /**
         * Sets the limit for the number of internal events before they are throttled
         * @param limit {number} - The throttle limit to set for internal events
         */
        static setMaxInternalMessageLimit(limit: number): void;
        /**
         * Logs a message to the internal queue.
         * @param severity {LoggingSeverity} - The severity of the log message
         * @param message {_InternalLogMessage} - The message to log.
         */
        private static logInternalMessage(severity, message);
        /**
         * Indicates whether the internal events are throttled
         */
        private static _areInternalMessagesThrottled();
    }
}
declare module Microsoft.ApplicationInsights {
    class Util {
        private static document;
        private static _canUseCookies;
        private static _canUseLocalStorage;
        private static _canUseSessionStorage;
        static NotSpecified: string;
        static disableStorage(): void;
        /**
         * Gets the localStorage object if available
         * @return {Storage} - Returns the storage object if available else returns null
         */
        private static _getLocalStorageObject();
        /**
         * Tests storage object (localStorage or sessionStorage) to verify that it is usable
         * More details here: https://mathiasbynens.be/notes/localstorage-pattern
         * @param storageType Type of storage
         * @return {Storage} Returns storage object verified that it is usable
         */
        private static _getVerifiedStorageObject(storageType);
        /**
         *  Check if the browser supports local storage.
         *
         *  @returns {boolean} True if local storage is supported.
         */
        static canUseLocalStorage(): boolean;
        /**
         *  Get an object from the browser's local storage
         *
         *  @param {string} name - the name of the object to get from storage
         *  @returns {string} The contents of the storage object with the given name. Null if storage is not supported.
         */
        static getStorage(name: string): string;
        /**
         *  Set the contents of an object in the browser's local storage
         *
         *  @param {string} name - the name of the object to set in storage
         *  @param {string} data - the contents of the object to set in storage
         *  @returns {boolean} True if the storage object could be written.
         */
        static setStorage(name: string, data: string): boolean;
        /**
         *  Remove an object from the browser's local storage
         *
         *  @param {string} name - the name of the object to remove from storage
         *  @returns {boolean} True if the storage object could be removed.
         */
        static removeStorage(name: string): boolean;
        /**
         * Gets the sessionStorage object if available
         * @return {Storage} - Returns the storage object if available else returns null
         */
        private static _getSessionStorageObject();
        /**
         *  Check if the browser supports session storage.
         *
         *  @returns {boolean} True if session storage is supported.
         */
        static canUseSessionStorage(): boolean;
        /**
         *  Gets the list of session storage keys
         *
         *  @returns {string[]} List of session storage keys
         */
        static getSessionStorageKeys(): string[];
        /**
         *  Get an object from the browser's session storage
         *
         *  @param {string} name - the name of the object to get from storage
         *  @returns {string} The contents of the storage object with the given name. Null if storage is not supported.
         */
        static getSessionStorage(name: string): string;
        /**
         *  Set the contents of an object in the browser's session storage
         *
         *  @param {string} name - the name of the object to set in storage
         *  @param {string} data - the contents of the object to set in storage
         *  @returns {boolean} True if the storage object could be written.
         */
        static setSessionStorage(name: string, data: string): boolean;
        /**
         *  Remove an object from the browser's session storage
         *
         *  @param {string} name - the name of the object to remove from storage
         *  @returns {boolean} True if the storage object could be removed.
         */
        static removeSessionStorage(name: string): boolean;
        static disableCookies(): void;
        static canUseCookies(): any;
        /**
         * helper method to set userId and sessionId cookie
         */
        static setCookie(name: any, value: any, domain?: any): void;
        static stringToBoolOrDefault(str: any): boolean;
        /**
         * helper method to access userId and sessionId cookie
         */
        static getCookie(name: any): string;
        /**
         * Deletes a cookie by setting it's expiration time in the past.
         * @param name - The name of the cookie to delete.
         */
        static deleteCookie(name: string): void;
        /**
         * helper method to trim strings (IE8 does not implement String.prototype.trim)
         */
        static trim(str: any): string;
        /**
         * generate random id string
         */
        static newId(): string;
        /**
         * Check if an object is of type Array
         */
        static isArray(obj: any): boolean;
        /**
         * Check if an object is of type Error
         */
        static isError(obj: any): boolean;
        /**
         * Check if an object is of type Date
         */
        static isDate(obj: any): boolean;
        /**
         * Convert a date to I.S.O. format in IE8
         */
        static toISOStringForIE8(date: Date): string;
        /**
         * Gets IE version if we are running on IE, or null otherwise
         */
        static getIEVersion(userAgentStr?: string): number;
        /**
         * Convert ms to c# time span format
         */
        static msToTimeSpan(totalms: number): string;
        /**
        * Checks if error has no meaningful data inside. Ususally such errors are received by window.onerror when error
        * happens in a script from other domain (cross origin, CORS).
        */
        static isCrossOriginError(message: string, url: string, lineNumber: number, columnNumber: number, error: Error): boolean;
        /**
        * Returns string representation of an object suitable for diagnostics logging.
        */
        static dump(object: any): string;
        /**
        * Returns the name of object if it's an Error. Otherwise, returns empty string.
        */
        static getExceptionName(object: any): string;
        /**
         * Adds an event handler for the specified event
         * @param eventName {string} - The name of the event
         * @param callback {any} - The callback function that needs to be executed for the given event
         * @return {boolean} - true if the handler was successfully added
         */
        static addEventHandler(eventName: string, callback: any): boolean;
    }
    class UrlHelper {
        private static document;
        private static htmlAnchorElement;
        static parseUrl(url: any): HTMLAnchorElement;
        static getAbsoluteUrl(url: any): string;
        static getPathName(url: any): string;
    }
}
declare module Microsoft.ApplicationInsights {
    class extensions {
        static IsNullOrUndefined(obj: any): boolean;
    }
    class stringUtils {
        static GetLength(strObject: any): number;
    }
    class dateTime {
        static Now: () => number;
        static GetDuration: (start: number, end: number) => number;
    }
    class EventHelper {
        static AttachEvent(obj: any, eventNameWithoutOn: any, handlerRef: any): boolean;
        static DetachEvent(obj: any, eventNameWithoutOn: any, handlerRef: any): void;
    }
}
declare module Microsoft.ApplicationInsights {
    class XHRMonitoringState {
        openDone: boolean;
        setRequestHeaderDone: boolean;
        sendDone: boolean;
        abortDone: boolean;
        onreadystatechangeCallbackAttached: boolean;
    }
    class ajaxRecord {
        completed: boolean;
        requestHeadersSize: any;
        ttfb: any;
        responseReceivingDuration: any;
        callbackDuration: any;
        ajaxTotalDuration: any;
        aborted: any;
        pageUrl: any;
        requestUrl: any;
        requestSize: number;
        method: any;
        status: any;
        requestSentTime: any;
        responseStartedTime: any;
        responseFinishedTime: any;
        callbackFinishedTime: any;
        endTime: any;
        originalOnreadystatechage: any;
        xhrMonitoringState: XHRMonitoringState;
        clientFailure: number;
        id: string;
        constructor(id: string);
        getAbsoluteUrl(): string;
        getPathName(): string;
        CalculateMetrics: () => void;
    }
}
declare module Microsoft.ApplicationInsights {
    interface XMLHttpRequestInstrumented extends XMLHttpRequest {
        ajaxData: ajaxRecord;
    }
    class AjaxMonitor {
        private appInsights;
        private initialized;
        private static instrumentedByAppInsightsName;
        private currentWindowHost;
        constructor(appInsights: Microsoft.ApplicationInsights.AppInsights);
        private Init();
        static DisabledPropertyName: string;
        private isMonitoredInstance(xhr, excludeAjaxDataValidation?);
        private supportsMonitoring();
        private instrumentOpen();
        private openHandler(xhr, method, url, async);
        private static getFailedAjaxDiagnosticsMessage(xhr);
        private instrumentSend();
        private sendHandler(xhr, content);
        private instrumentAbort();
        private attachToOnReadyStateChange(xhr);
        private onAjaxComplete(xhr);
    }
}
declare module Microsoft.ApplicationInsights {
    class HashCodeScoreGenerator {
        static INT_MAX_VALUE: number;
        private static MIN_INPUT_LENGTH;
        getHashCodeScore(key: string): number;
        getHashCode(input: string): number;
    }
}
declare module Microsoft.ApplicationInsights {
    class PerformanceAnalyzer {
        private enabled;
        private appInsights;
        private performanceSendInterval;
        private resourceFilters;
        private intervalHandler;
        private resourcesLogged;
        constructor(appInsights: IAppInsights);
        Init(): void;
        IsPerformanceApiSupported(): boolean;
        SendPerfData(): void;
        private IsMatching(name);
    }
}
declare module Microsoft.ApplicationInsights {
    interface ISerializable {
        /**
         * The set of fields for a serializeable object.
         * This defines the serialization order and a value of true/false
         * for each field defines whether the field is required or not.
         */
        aiDataContract: any;
    }
}
declare module Microsoft.ApplicationInsights {
    /**
     * Enum is used in aiDataContract to describe how fields are serialized.
     * For instance: (Fieldtype.Required | FieldType.Array) will mark the field as required and indicate it's an array
     */
    enum FieldType {
        Default = 0,
        Required = 1,
        Array = 2,
        Hidden = 4,
    }
    class Serializer {
        /**
         * Serializes the current object to a JSON string.
         */
        static serialize(input: ISerializable): string;
        private static _serializeObject(source, name);
        private static _serializeArray(sources, name);
        private static _serializeStringMap(map, expectedType, name);
    }
}
declare module Microsoft.Telemetry {
    class Base {
        baseType: string;
        constructor();
    }
}
declare module Microsoft.Telemetry {
    class Envelope {
        ver: number;
        name: string;
        time: string;
        sampleRate: number;
        seq: string;
        iKey: string;
        flags: number;
        deviceId: string;
        os: string;
        osVer: string;
        appId: string;
        appVer: string;
        userId: string;
        tags: any;
        data: Base;
        constructor();
    }
}
declare module Microsoft.ApplicationInsights.Telemetry.Common {
    class Envelope extends Microsoft.Telemetry.Envelope implements IEnvelope {
        /**
         * The data contract for serializing this object.
         */
        aiDataContract: any;
        /**
         * Constructs a new instance of telemetry data.
         */
        constructor(data: Microsoft.Telemetry.Base, name: string);
    }
}
declare module Microsoft.ApplicationInsights.Telemetry.Common {
    class Base extends Microsoft.Telemetry.Base implements ISerializable {
        /**
         * The data contract for serializing this object.
         */
        aiDataContract: {};
    }
}
declare module AI {
    class ContextTagKeys {
        applicationVersion: string;
        applicationBuild: string;
        applicationTypeId: string;
        applicationId: string;
        deviceId: string;
        deviceIp: string;
        deviceLanguage: string;
        deviceLocale: string;
        deviceModel: string;
        deviceNetwork: string;
        deviceNetworkName: string;
        deviceOEMName: string;
        deviceOS: string;
        deviceOSVersion: string;
        deviceRoleInstance: string;
        deviceRoleName: string;
        deviceScreenResolution: string;
        deviceType: string;
        deviceMachineName: string;
        deviceVMName: string;
        locationIp: string;
        operationId: string;
        operationName: string;
        operationParentId: string;
        operationRootId: string;
        operationSyntheticSource: string;
        operationIsSynthetic: string;
        operationCorrelationVector: string;
        sessionId: string;
        sessionIsFirst: string;
        sessionIsNew: string;
        userAccountAcquisitionDate: string;
        userAccountId: string;
        userAgent: string;
        userId: string;
        userStoreRegion: string;
        userAuthUserId: string;
        userAnonymousUserAcquisitionDate: string;
        userAuthenticatedUserAcquisitionDate: string;
        sampleRate: string;
        cloudName: string;
        cloudRoleVer: string;
        cloudEnvironment: string;
        cloudLocation: string;
        cloudDeploymentUnit: string;
        serverDeviceOS: string;
        serverDeviceOSVer: string;
        internalSdkVersion: string;
        internalAgentVersion: string;
        internalDataCollectorReceivedTime: string;
        internalProfileId: string;
        internalProfileClassId: string;
        internalAccountId: string;
        internalApplicationName: string;
        internalInstrumentationKey: string;
        internalTelemetryItemId: string;
        internalApplicationType: string;
        internalRequestSource: string;
        internalFlowType: string;
        internalIsAudit: string;
        internalTrackingSourceId: string;
        internalTrackingType: string;
        internalIsDiagnosticExample: string;
        constructor();
    }
}
declare module Microsoft.ApplicationInsights.Context {
    interface IApplication {
        /**
         * The application version.
         */
        ver: string;
        /**
         * The application build version.
         */
        build: string;
    }
}
declare module Microsoft.ApplicationInsights.Context {
    class Application implements IApplication {
        /**
         * The application version.
         */
        ver: string;
        /**
         * The application build version.
         */
        build: string;
    }
}
declare module Microsoft.ApplicationInsights.Context {
    interface IDevice {
        /**
         * The type for the current device.
         */
        type: string;
        /**
         * A device unique ID.
         */
        id: string;
        /**
         * The device OEM for the current device.
         */
        oemName: string;
        /**
         * The device model for the current device.
         */
        model: string;
        /**
         * The IANA interface type for the internet connected network adapter.
         */
        network: number;
        /**
         * The application screen resolution.
         */
        resolution: string;
        /**
         * The current display language of the operating system.
         */
        locale: string;
        /**
         * The IP address.
         */
        ip: string;
        /**
         * The device language.
         */
        language: string;
        /**
         * The OS name.
         */
        os: string;
        /**
         * The OS version.
         */
        osversion: string;
    }
}
declare module Microsoft.ApplicationInsights.Context {
    class Device implements IDevice {
        /**
         * The type for the current device.
         */
        type: string;
        /**
         * A device unique ID.
         */
        id: string;
        /**
         * The device OEM for the current device.
         */
        oemName: string;
        /**
         * The device model for the current device.
         */
        model: string;
        /**
         * The IANA interface type for the internet connected network adapter.
         */
        network: number;
        /**
         * The application screen resolution.
         */
        resolution: string;
        /**
         * The current display language of the operating system.
         */
        locale: string;
        /**
         * The IP address.
         */
        ip: string;
        /**
         * The device language.
         */
        language: string;
        /**
         * The OS name.
         */
        os: string;
        /**
         * The OS version.
         */
        osversion: string;
        /**
         * Constructs a new instance of the Device class
         */
        constructor();
    }
}
declare module Microsoft.ApplicationInsights.Context {
    interface IInternal {
        /**
        * The SDK version used to create this telemetry item.
        */
        sdkVersion: string;
        /**
         * The SDK agent version.
         */
        agentVersion: string;
    }
}
declare module Microsoft.ApplicationInsights.Context {
    class Internal implements IInternal {
        /**
         * The SDK version used to create this telemetry item.
         */
        sdkVersion: string;
        /**
         * The SDK agent version.
         */
        agentVersion: string;
        /**
        * Constructs a new instance of the internal telemetry data class.
        */
        constructor();
    }
}
declare module Microsoft.ApplicationInsights.Context {
    interface ILocation {
        /**
         * Client IP address for reverse lookup
         */
        ip: string;
    }
}
declare module Microsoft.ApplicationInsights.Context {
    class Location implements ILocation {
        /**
         * Client IP address for reverse lookup
         */
        ip: string;
    }
}
declare module Microsoft.ApplicationInsights.Context {
    interface IOperation {
        /**
         * Operation id
         */
        id: string;
        /**
         * Operation name
         */
        name: string;
        /**
         * Parent operation id
         */
        parentId: string;
        /**
         * Root operation id
         */
        rootId: string;
        /**
         * Synthetic source of the operation
         */
        syntheticSource: string;
    }
}
declare module Microsoft.ApplicationInsights.Context {
    class Operation implements IOperation {
        id: string;
        name: string;
        parentId: string;
        rootId: string;
        syntheticSource: string;
        constructor();
    }
}
declare module Microsoft.ApplicationInsights {
    class SamplingScoreGenerator {
        private hashCodeGeneragor;
        constructor();
        getSamplingScore(envelope: Microsoft.ApplicationInsights.IEnvelope): number;
    }
}
declare module Microsoft.ApplicationInsights.Context {
    interface ISample {
        /**
        * Sample rate
        */
        sampleRate: number;
    }
}
declare module Microsoft.ApplicationInsights.Context {
    class Sample implements ISample {
        sampleRate: number;
        private samplingScoreGenerator;
        INT_MAX_VALUE: number;
        constructor(sampleRate: number);
        /**
        * Determines if an envelope is sampled in (i.e. will be sent) or not (i.e. will be dropped).
        */
        isSampledIn(envelope: Microsoft.ApplicationInsights.IEnvelope): boolean;
    }
}
declare module AI {
    enum SessionState {
        Start = 0,
        End = 1,
    }
}
declare module Microsoft.ApplicationInsights.Context {
    interface ISession {
        /**
        * The session ID.
        */
        id: string;
        /**
         * The true if this is the first session
         */
        isFirst: boolean;
        /**
         * The date at which this guid was genereated.
         * Per the spec the ID will be regenerated if more than acquisitionSpan milliseconds ellapse from this time.
         */
        acquisitionDate: number;
        /**
         * The date at which this session ID was last reported.
         * This value should be updated whenever telemetry is sent using this ID.
         * Per the spec the ID will be regenerated if more than renewalSpan milliseconds elapse from this time with no activity.
         */
        renewalDate: number;
    }
}
declare module Microsoft.ApplicationInsights.Context {
    interface ISessionConfig {
        sessionRenewalMs: () => number;
        sessionExpirationMs: () => number;
        cookieDomain: () => string;
    }
    class Session implements ISession {
        /**
         * The session ID.
         */
        id: string;
        /**
         * The true if this is the first session
         */
        isFirst: boolean;
        /**
         * The date at which this guid was genereated.
         * Per the spec the ID will be regenerated if more than acquisitionSpan milliseconds ellapse from this time.
         */
        acquisitionDate: number;
        /**
         * The date at which this session ID was last reported.
         * This value should be updated whenever telemetry is sent using this ID.
         * Per the spec the ID will be regenerated if more than renewalSpan milliseconds elapse from this time with no activity.
         */
        renewalDate: number;
    }
    class _SessionManager {
        static acquisitionSpan: number;
        static renewalSpan: number;
        static cookieUpdateInterval: number;
        automaticSession: Session;
        config: ISessionConfig;
        private cookieUpdatedTimestamp;
        constructor(config: ISessionConfig);
        update(): void;
        /**
         *  Record the current state of the automatic session and store it in our cookie string format
         *  into the browser's local storage. This is used to restore the session data when the cookie
         *  expires.
         */
        backup(): void;
        /**
         *  Use ai_session cookie data or local storage data (when the cookie is unavailable) to
         *  initialize the automatic session.
         */
        private initializeAutomaticSession();
        /**
         *  Extract id, aquisitionDate, and renewalDate from an ai_session payload string and
         *  use this data to initialize automaticSession.
         *
         *  @param {string} sessionData - The string stored in an ai_session cookie or local storage backup
         */
        private initializeAutomaticSessionWithData(sessionData);
        private renew();
        private setCookie(guid, acq, renewal);
        private setStorage(guid, acq, renewal);
    }
}
declare module Microsoft.ApplicationInsights.Context {
    interface IUser {
        /**
        * The telemetry configuration.
        */
        config: any;
        /**
         * The user ID.
         */
        id: string;
        /**
         * Authenticated user id
         */
        authenticatedId: string;
        /**
         * The account ID.
         */
        accountId: string;
        /**
         * The account acquisition date.
         */
        accountAcquisitionDate: string;
        /**
         * The user agent string.
         */
        agent: string;
        /**
         * The store region.
         */
        storeRegion: string;
    }
}
declare module Microsoft.ApplicationInsights.Context {
    class User implements IUser {
        static cookieSeparator: string;
        static userCookieName: string;
        static authUserCookieName: string;
        /**
         * The telemetry configuration.
         */
        config: ITelemetryConfig;
        /**
         * The user ID.
         */
        id: string;
        /**
         * Authenticated user id
         */
        authenticatedId: string;
        /**
         * The account ID.
         */
        accountId: string;
        /**
         * The account acquisition date.
         */
        accountAcquisitionDate: string;
        /**
         * The user agent string.
         */
        agent: string;
        /**
         * The store region.
         */
        storeRegion: string;
        /**
        * Sets the autheticated user id and the account id in this session.
        *
        * @param authenticatedUserId {string} - The authenticated user id. A unique and persistent string that represents each authenticated user in the service.
        * @param accountId {string} - An optional string to represent the account associated with the authenticated user.
        */
        setAuthenticatedUserContext(authenticatedUserId: string, accountId?: string): void;
        /**
         * Clears the authenticated user id and the account id from the user context.
         * @returns {}
         */
        clearAuthenticatedUserContext(): void;
        constructor(config: ITelemetryConfig);
        private validateUserInput(id);
    }
}
declare module Microsoft.ApplicationInsights {
    class DataLossAnalyzer {
        static enabled: boolean;
        static appInsights: Microsoft.ApplicationInsights.AppInsights;
        static issuesReportedForThisSession: any;
        static itemsRestoredFromSessionBuffer: number;
        static LIMIT_PER_SESSION: number;
        static ITEMS_QUEUED_KEY: string;
        static ISSUES_REPORTED_KEY: string;
        static reset(): void;
        private static isEnabled();
        static getIssuesReported(): number;
        static incrementItemsQueued(): void;
        static decrementItemsQueued(countOfItemsSentSuccessfully: number): void;
        static getNumberOfLostItems(): number;
        static reportLostItems(): void;
    }
}
declare module Microsoft.ApplicationInsights {
    interface ISendBuffer {
        /**
         * Enqueue the payload
         */
        enqueue: (payload: string) => void;
        /**
         * Returns the number of elements in the buffer
         */
        count: () => number;
        /**
         * Clears the buffer
         */
        clear: () => void;
        /**
         * Returns items stored in the buffer
         */
        getItems: () => string[];
        /**
         * Build a batch of all elements in the payload array
         */
        batchPayloads: (payload: string[]) => string;
        /**
         * Moves items to the SENT_BUFFER.
         * The buffer holds items which were sent, but we haven't received any response from the backend yet.
         */
        markAsSent: (payload: string[]) => void;
        /**
         * Removes items from the SENT_BUFFER. Should be called on successful response from the backend.
         */
        clearSent: (payload: string[]) => void;
    }
    class ArraySendBuffer implements ISendBuffer {
        private _config;
        private _buffer;
        constructor(config: ISenderConfig);
        enqueue(payload: string): void;
        count(): number;
        clear(): void;
        getItems(): string[];
        batchPayloads(payload: string[]): string;
        markAsSent(payload: string[]): void;
        clearSent(payload: string[]): void;
    }
    class SessionStorageSendBuffer implements ISendBuffer {
        static BUFFER_KEY: string;
        static SENT_BUFFER_KEY: string;
        static MAX_BUFFER_SIZE: number;
        private _bufferFullMessageSent;
        private _buffer;
        private _config;
        constructor(config: ISenderConfig);
        enqueue(payload: string): void;
        count(): number;
        clear(): void;
        getItems(): string[];
        batchPayloads(payload: string[]): string;
        markAsSent(payload: string[]): void;
        clearSent(payload: string[]): void;
        private removePayloadsFromBuffer(payloads, buffer);
        private getBuffer(key);
        private setBuffer(key, buffer);
    }
}
interface XDomainRequest extends XMLHttpRequestEventTarget {
    responseText: string;
    send(payload: string): any;
    open(method: string, url: string): any;
}
declare var XDomainRequest: {
    prototype: XDomainRequest;
    new (): XDomainRequest;
};
declare module Microsoft.ApplicationInsights {
    interface ISenderConfig {
        /**
         * The url to which payloads will be sent
         */
        endpointUrl: () => string;
        /**
        * The JSON format (normal vs line delimited). True means line delimited JSON.
        */
        emitLineDelimitedJson: () => boolean;
        /**
         * The maximum size of a batch in bytes
         */
        maxBatchSizeInBytes: () => number;
        /**
         * The maximum interval allowed between calls to batchInvoke
         */
        maxBatchInterval: () => number;
        /**
         * The master off switch.  Do not send any data if set to TRUE
         */
        disableTelemetry: () => boolean;
        /**
         * Store a copy of a send buffer in the session storage
         */
        enableSessionStorageBuffer: () => boolean;
        /**
         * Is retry handler disabled.
         * If enabled, retry on 206 (partial success), 408 (timeout), 429 (too many requests), 500 (internal server error) and 503 (service unavailable).
         */
        isRetryDisabled: () => boolean;
    }
    interface IResponseError {
        index: number;
        statusCode: number;
        message: string;
    }
    interface IBackendResponse {
        /**
         * Number of items received by the backend
         */
        itemsReceived: number;
        /**
         * Number of items succesfuly accepted by the backend
         */
        itemsAccepted: number;
        /**
         * List of errors for items which were not accepted
         */
        errors: IResponseError[];
    }
    class Sender {
        /**
         * How many times in a row a retryable error condition has occurred.
         */
        private _consecutiveErrors;
        /**
         * The time to retry at in milliseconds from 1970/01/01 (this makes the timer calculation easy).
         */
        private _retryAt;
        /**
         * The time of the last send operation.
         */
        private _lastSend;
        /**
         * Handle to the timer for delayed sending of batches of data.
         */
        private _timeoutHandle;
        /**
         * A send buffer object
         */
        _buffer: ISendBuffer;
        /**
         * The configuration for this sender instance
         */
        _config: ISenderConfig;
        /**
         * A method which will cause data to be send to the url
         */
        _sender: (payload: string[], isAsync: boolean) => void;
        /**
         * Whether XMLHttpRequest object is supported. Older version of IE (8,9) do not support it.
         */
        _XMLHttpRequestSupported: boolean;
        /**
         * Constructs a new instance of the Sender class
         */
        constructor(config: ISenderConfig);
        /**
         * Add a telemetry item to the send buffer
         */
        send(envelope: Microsoft.ApplicationInsights.IEnvelope): void;
        /**
         * Sets up the timer which triggers actually sending the data.
         */
        private _setupTimer();
        /**
         * Gets the size of the list in bytes.
         * @param list {string[]} - The list to get the size in bytes of.
         */
        private _getSizeInBytes(list);
        /**
         * Immediately send buffered data
         * @param async {boolean} - Indicates if the events should be sent asynchronously (Optional, Defaults to true)
         */
        triggerSend(async?: boolean): void;
        /** Calculates the time to wait before retrying in case of an error based on
         * http://en.wikipedia.org/wiki/Exponential_backoff
         */
        private _setRetryTime();
        /**
         * Parses the response from the backend.
         * @param response - XMLHttpRequest or XDomainRequest response
         */
        private _parseResponse(response);
        /**
         * Checks if the SDK should resend the payload after receiving this status code from the backend.
         * @param statusCode
         */
        private _isRetriable(statusCode);
        /**
         * Resend payload. Adds payload back to the send buffer and setup a send timer (with exponential backoff).
         * @param payload
         */
        private _resendPayload(payload);
        /**
         * Send XMLHttpRequest
         * @param payload {string} - The data payload to be sent.
         * @param isAsync {boolean} - Indicates if the request should be sent asynchronously
         */
        private _xhrSender(payload, isAsync);
        /**
         * Send XDomainRequest
         * @param payload {string} - The data payload to be sent.
         * @param isAsync {boolean} - Indicates if the request should be sent asynchronously
         *
         * Note: XDomainRequest does not support sync requests. This 'isAsync' parameter is added
         * to maintain consistency with the xhrSender's contract
         */
        private _xdrSender(payload, isAsync);
        /**
         * xhr state changes
         */
        _xhrReadyStateChange(xhr: XMLHttpRequest, payload: string[], countOfItemsInPayload: number): void;
        /**
         * xdr state changes
         */
        _xdrOnLoad(xdr: XDomainRequest, payload: string[]): void;
        /**
         * partial success handler
         */
        _onPartialSuccess(payload: string[], results: IBackendResponse): void;
        /**
         * error handler
         */
        _onError(payload: string[], message: string, event?: ErrorEvent): void;
        /**
         * success handler
         */
        _onSuccess(payload: string[], countOfItemsInPayload: number): void;
    }
}
declare module Microsoft.ApplicationInsights {
    class SplitTest {
        private hashCodeGeneragor;
        isEnabled(key: string, percentEnabled: number): boolean;
    }
}
declare module Microsoft.Telemetry {
    class Domain {
        constructor();
    }
}
declare module AI {
    enum SeverityLevel {
        Verbose = 0,
        Information = 1,
        Warning = 2,
        Error = 3,
        Critical = 4,
    }
}
declare module AI {
    class MessageData extends Microsoft.Telemetry.Domain {
        ver: number;
        message: string;
        severityLevel: AI.SeverityLevel;
        properties: any;
        constructor();
    }
}
declare module Microsoft.ApplicationInsights.Telemetry.Common {
    class DataSanitizer {
        /**
        * Max length allowed for custom names.
        */
        private static MAX_NAME_LENGTH;
        /**
         * Max length allowed for custom values.
         */
        private static MAX_STRING_LENGTH;
        /**
         * Max length allowed for url.
         */
        private static MAX_URL_LENGTH;
        /**
         * Max length allowed for messages.
         */
        private static MAX_MESSAGE_LENGTH;
        /**
         * Max length allowed for exceptions.
         */
        private static MAX_EXCEPTION_LENGTH;
        static sanitizeKeyAndAddUniqueness(key: any, map: any): any;
        static sanitizeKey(name: any): any;
        static sanitizeString(value: any): any;
        static sanitizeUrl(url: any): any;
        static sanitizeMessage(message: any): any;
        static sanitizeException(exception: any): any;
        static sanitizeProperties(properties: any): any;
        static sanitizeMeasurements(measurements: any): any;
        static padNumber(num: any): string;
    }
}
declare module Microsoft.ApplicationInsights.Telemetry {
    class Trace extends AI.MessageData implements ISerializable {
        static envelopeType: string;
        static dataType: string;
        aiDataContract: {
            ver: FieldType;
            message: FieldType;
            severityLevel: FieldType;
            measurements: FieldType;
            properties: FieldType;
        };
        /**
         * Constructs a new instance of the MetricTelemetry object
         */
        constructor(message: string, properties?: Object);
    }
}
declare module AI {
    class EventData extends Microsoft.Telemetry.Domain {
        ver: number;
        name: string;
        properties: any;
        measurements: any;
        constructor();
    }
}
declare module Microsoft.ApplicationInsights.Telemetry {
    class Event extends AI.EventData implements ISerializable {
        static envelopeType: string;
        static dataType: string;
        aiDataContract: {
            ver: FieldType;
            name: FieldType;
            properties: FieldType;
            measurements: FieldType;
        };
        /**
         * Constructs a new instance of the EventTelemetry object
         */
        constructor(name: string, properties?: Object, measurements?: Object);
    }
}
declare module AI {
    class ExceptionDetails {
        id: number;
        outerId: number;
        typeName: string;
        message: string;
        hasFullStack: boolean;
        stack: string;
        parsedStack: StackFrame[];
        constructor();
    }
}
declare module AI {
    class ExceptionData extends Microsoft.Telemetry.Domain {
        ver: number;
        handledAt: string;
        exceptions: ExceptionDetails[];
        severityLevel: AI.SeverityLevel;
        problemId: string;
        crashThreadId: number;
        properties: any;
        measurements: any;
        constructor();
    }
}
declare module AI {
    class StackFrame {
        level: number;
        method: string;
        assembly: string;
        fileName: string;
        line: number;
        constructor();
    }
}
declare module Microsoft.ApplicationInsights.Telemetry {
    class Exception extends AI.ExceptionData implements ISerializable {
        static envelopeType: string;
        static dataType: string;
        aiDataContract: {
            ver: FieldType;
            handledAt: FieldType;
            exceptions: FieldType;
            severityLevel: FieldType;
            properties: FieldType;
            measurements: FieldType;
        };
        /**
        * Constructs a new isntance of the ExceptionTelemetry object
        */
        constructor(exception: Error, handledAt?: string, properties?: Object, measurements?: Object, severityLevel?: AI.SeverityLevel);
        /**
        * Creates a simple exception with 1 stack frame. Useful for manual constracting of exception.
        */
        static CreateSimpleException(message: string, typeName: string, assembly: string, fileName: string, details: string, line: number, handledAt?: string): Telemetry.Exception;
    }
    class _StackFrame extends AI.StackFrame implements ISerializable {
        static regex: RegExp;
        static baseSize: number;
        sizeInBytes: number;
        aiDataContract: {
            level: FieldType;
            method: FieldType;
            assembly: FieldType;
            fileName: FieldType;
            line: FieldType;
        };
        constructor(frame: string, level: number);
    }
}
declare module AI {
    class MetricData extends Microsoft.Telemetry.Domain {
        ver: number;
        metrics: DataPoint[];
        properties: any;
        constructor();
    }
}
declare module AI {
    enum DataPointType {
        Measurement = 0,
        Aggregation = 1,
    }
}
declare module AI {
    class DataPoint {
        name: string;
        kind: AI.DataPointType;
        value: number;
        count: number;
        min: number;
        max: number;
        stdDev: number;
        constructor();
    }
}
declare module Microsoft.ApplicationInsights.Telemetry.Common {
    class DataPoint extends AI.DataPoint implements ISerializable {
        /**
         * The data contract for serializing this object.
         */
        aiDataContract: {
            name: FieldType;
            kind: FieldType;
            value: FieldType;
            count: FieldType;
            min: FieldType;
            max: FieldType;
            stdDev: FieldType;
        };
    }
}
declare module Microsoft.ApplicationInsights.Telemetry {
    class Metric extends AI.MetricData implements ISerializable {
        static envelopeType: string;
        static dataType: string;
        aiDataContract: {
            ver: FieldType;
            metrics: FieldType;
            properties: FieldType;
        };
        /**
         * Constructs a new instance of the MetricTelemetry object
         */
        constructor(name: string, value: number, count?: number, min?: number, max?: number, properties?: Object);
    }
}
declare module AI {
    class PageViewData extends AI.EventData {
        ver: number;
        url: string;
        name: string;
        duration: string;
        referrer: string;
        referrerData: string;
        properties: any;
        measurements: any;
        constructor();
    }
}
declare module Microsoft.ApplicationInsights.Telemetry {
    class PageView extends AI.PageViewData implements ISerializable {
        static envelopeType: string;
        static dataType: string;
        aiDataContract: {
            ver: FieldType;
            name: FieldType;
            url: FieldType;
            duration: FieldType;
            properties: FieldType;
            measurements: FieldType;
        };
        /**
         * Constructs a new instance of the PageEventTelemetry object
         */
        constructor(name?: string, url?: string, durationMs?: number, properties?: any, measurements?: any);
    }
}
declare module AI {
    class PageViewPerfData extends AI.PageViewData {
        ver: number;
        url: string;
        perfTotal: string;
        name: string;
        duration: string;
        networkConnect: string;
        referrer: string;
        sentRequest: string;
        referrerData: string;
        receivedResponse: string;
        domProcessing: string;
        properties: any;
        measurements: any;
        constructor();
    }
}
declare module Microsoft.ApplicationInsights.Telemetry {
    class PageViewPerformance extends AI.PageViewPerfData implements ISerializable {
        static envelopeType: string;
        static dataType: string;
        aiDataContract: {
            ver: FieldType;
            name: FieldType;
            url: FieldType;
            duration: FieldType;
            perfTotal: FieldType;
            networkConnect: FieldType;
            sentRequest: FieldType;
            receivedResponse: FieldType;
            domProcessing: FieldType;
            properties: FieldType;
            measurements: FieldType;
        };
        /**
         * Field indicating whether this instance of PageViewPerformance is valid and should be sent
         */
        private isValid;
        /**
         * Indicates whether this instance of PageViewPerformance is valid and should be sent
         */
        getIsValid(): boolean;
        private durationMs;
        /**
        * Gets the total duration (PLT) in milliseconds. Check getIsValid() before using this method.
        */
        getDurationMs(): number;
        /**
         * Constructs a new instance of the PageEventTelemetry object
         */
        constructor(name: string, url: string, unused: number, properties?: any, measurements?: any);
        static getPerformanceTiming(): PerformanceTiming;
        /**
        * Returns true is window performance timing API is supported, false otherwise.
        */
        static isPerformanceTimingSupported(): PerformanceTiming;
        /**
         * As page loads different parts of performance timing numbers get set. When all of them are set we can report it.
         * Returns true if ready, false otherwise.
         */
        static isPerformanceTimingDataReady(): boolean;
        static getDuration(start: any, end: any): number;
    }
}
declare module Microsoft.ApplicationInsights {
    interface IEnvelope extends ISerializable {
        ver: number;
        name: string;
        time: string;
        sampleRate: number;
        seq: string;
        iKey: string;
        flags: number;
        deviceId: string;
        os: string;
        osVer: string;
        appId: string;
        appVer: string;
        userId: string;
        tags: {
            [name: string]: any;
        };
    }
}
declare module Microsoft.ApplicationInsights {
    interface ITelemetryContext {
        /**
        * The object describing a component tracked by this object.
        */
        application: Context.IApplication;
        /**
         * The object describing a device tracked by this object.
         */
        device: Context.IDevice;
        /**
        * The object describing internal settings.
        */
        internal: Context.IInternal;
        /**
         * The object describing a location tracked by this object.
         */
        location: Context.ILocation;
        /**
         * The object describing a operation tracked by this object.
         */
        operation: Context.IOperation;
        /**
        * The object describing sampling settings.
        */
        sample: Context.ISample;
        /**
         * The object describing a user tracked by this object.
         */
        user: Context.IUser;
        /**
         * The object describing a session tracked by this object.
         */
        session: Context.ISession;
        /**
        * Adds telemetry initializer to the collection. Telemetry initializers will be called one by one
        * before telemetry item is pushed for sending and in the order they were added.
        */
        addTelemetryInitializer(telemetryInitializer: (envelope: Microsoft.ApplicationInsights.IEnvelope) => boolean): any;
        /**
        * Tracks telemetry object.
        */
        track(envelope: Microsoft.ApplicationInsights.IEnvelope): any;
    }
}
declare module Microsoft.ApplicationInsights {
    interface ITelemetryConfig extends ISenderConfig {
        instrumentationKey: () => string;
        accountId: () => string;
        sessionRenewalMs: () => number;
        sessionExpirationMs: () => number;
        sampleRate: () => number;
        endpointUrl: () => string;
        cookieDomain: () => string;
    }
    class TelemetryContext implements ITelemetryContext {
        /**
         * The configuration for this telemetry context
         */
        _config: ITelemetryConfig;
        /**
         * The sender instance for this context
         */
        _sender: Sender;
        /**
         * The object describing a component tracked by this object.
         */
        application: Context.Application;
        /**
         * The object describing a device tracked by this object.
         */
        device: Context.Device;
        internal: Context.Internal;
        /**
         * The object describing a location tracked by this object.
         */
        location: Context.Location;
        /**
         * The object describing a operation tracked by this object.
         */
        operation: Context.Operation;
        sample: Context.Sample;
        /**
         * The object describing a user tracked by this object.
         */
        user: Context.User;
        /**
         * The object describing a session tracked by this object.
         */
        session: Context.Session;
        /**
        * The array of telemetry initializers to call before sending each telemetry item.
        */
        private telemetryInitializers;
        /**
         * The session manager that manages session on the base of cookies.
         */
        _sessionManager: Microsoft.ApplicationInsights.Context._SessionManager;
        constructor(config: ITelemetryConfig);
        /**
        * Adds telemetry initializer to the collection. Telemetry initializers will be called one by one
        * before telemetry item is pushed for sending and in the order they were added.
        */
        addTelemetryInitializer(telemetryInitializer: (envelope: Microsoft.ApplicationInsights.IEnvelope) => boolean): void;
        /**
         * Use Sender.ts to send telemetry object to the endpoint
         */
        track(envelope: Microsoft.ApplicationInsights.IEnvelope): IEnvelope;
        private _track(envelope);
        private _applyApplicationContext(envelope, appContext);
        private _applyDeviceContext(envelope, deviceContext);
        private _applyInternalContext(envelope, internalContext);
        private _applyLocationContext(envelope, locationContext);
        private _applyOperationContext(envelope, operationContext);
        private _applySampleContext(envelope, sampleContext);
        private _applySessionContext(envelope, sessionContext);
        private _applyUserContext(envelope, userContext);
    }
}
declare module Microsoft.Telemetry {
    class Data<TDomain> extends Microsoft.Telemetry.Base {
        baseType: string;
        baseData: TDomain;
        constructor();
    }
}
declare module Microsoft.ApplicationInsights.Telemetry.Common {
    class Data<TDomain> extends Microsoft.Telemetry.Data<TDomain> implements ISerializable {
        /**
         * The data contract for serializing this object.
         */
        aiDataContract: {
            baseType: FieldType;
            baseData: FieldType;
        };
        /**
         * Constructs a new instance of telemetry data.
         */
        constructor(type: string, data: TDomain);
    }
}
declare module Microsoft.ApplicationInsights.Telemetry {
    /**
    * Class encapsulates sending page views and page view performance telemetry.
    */
    class PageViewManager {
        private pageViewPerformanceSent;
        private overridePageViewDuration;
        private appInsights;
        constructor(appInsights: IAppInsightsInternal, overridePageViewDuration: boolean);
        /**
        * Currently supported cases:
        * 1) (default case) track page view called with default parameters, overridePageViewDuration = false. Page view is sent with page view performance when navigation timing data is available.
        *    If navigation timing is not supported then page view is sent right away with 0 duration. Page view performance is not sent.
        * 2) overridePageViewDuration = true, custom duration provided. Custom duration is used, page view sends right away.
        * 3) overridePageViewDuration = true. Page view is sent right away, duration is time spent from page load till now (or 0 is navigation timing is not supported).
        * 4) overridePageViewDuration = false, custom duration is provided. Page view is sent right away with custom duration.
        *
        * In all cases page view performance is sent once (only for the 1st call of trackPageView), or not sent if navigation timing is not supported.
        */
        trackPageView(name?: string, url?: string, properties?: Object, measurements?: Object, duration?: number): void;
    }
}
declare module Microsoft.ApplicationInsights.Telemetry {
    /**
     * Used to track page visit durations
     */
    class PageVisitTimeManager {
        private prevPageVisitDataKeyName;
        private pageVisitTimeTrackingHandler;
        /**
         * Creates a new instance of PageVisitTimeManager
         * @param pageVisitTimeTrackingHandler Delegate that will be called to send telemetry data to AI (when trackPreviousPageVisit is called)
         * @returns {}
         */
        constructor(pageVisitTimeTrackingHandler: (pageName: string, pageUrl: string, pageVisitTime: number) => void);
        /**
        * Tracks the previous page visit time telemetry (if exists) and starts timing of new page visit time
        * @param currentPageName Name of page to begin timing for visit duration
        * @param currentPageUrl Url of page to begin timing for visit duration
        */
        trackPreviousPageVisit(currentPageName: string, currentPageUrl: string): void;
        /**
         * Stops timing of current page (if exists) and starts timing for duration of visit to pageName
         * @param pageName Name of page to begin timing visit duration
         * @returns {PageVisitData} Page visit data (including duration) of pageName from last call to start or restart, if exists. Null if not.
         */
        restartPageVisitTimer(pageName: string, pageUrl: string): PageVisitData;
        /**
         * Starts timing visit duration of pageName
         * @param pageName
         * @returns {}
         */
        startPageVisitTimer(pageName: string, pageUrl: string): void;
        /**
         * Stops timing of current page, if exists.
         * @returns {PageVisitData} Page visit data (including duration) of pageName from call to start, if exists. Null if not.
         */
        stopPageVisitTimer(): PageVisitData;
    }
    class PageVisitData {
        pageName: string;
        pageUrl: string;
        pageVisitStartTime: number;
        pageVisitTime: number;
        constructor(pageName: any, pageUrl: any);
    }
}
declare module AI {
    enum DependencyKind {
        SQL = 0,
        Http = 1,
        Other = 2,
    }
}
declare module AI {
    enum DependencySourceType {
        Undefined = 0,
        Aic = 1,
        Apmc = 2,
    }
}
declare module AI {
    class RemoteDependencyData extends Microsoft.Telemetry.Domain {
        ver: number;
        name: string;
        id: string;
        resultCode: string;
        kind: AI.DataPointType;
        value: number;
        count: number;
        min: number;
        max: number;
        stdDev: number;
        dependencyKind: AI.DependencyKind;
        success: boolean;
        async: boolean;
        dependencySource: AI.DependencySourceType;
        commandName: string;
        dependencyTypeName: string;
        properties: any;
        measurements: any;
        constructor();
    }
}
declare module Microsoft.ApplicationInsights.Telemetry {
    class RemoteDependencyData extends AI.RemoteDependencyData implements ISerializable {
        static envelopeType: string;
        static dataType: string;
        aiDataContract: {
            id: FieldType;
            ver: FieldType;
            name: FieldType;
            kind: FieldType;
            value: FieldType;
            count: FieldType;
            min: FieldType;
            max: FieldType;
            stdDev: FieldType;
            dependencyKind: FieldType;
            success: FieldType;
            async: FieldType;
            dependencySource: FieldType;
            commandName: FieldType;
            dependencyTypeName: FieldType;
            properties: FieldType;
            resultCode: FieldType;
            measurements: FieldType;
        };
        /**
         * Constructs a new instance of the RemoteDependencyData object
         */
        constructor(id: string, absoluteUrl: string, commandName: string, value: number, success: boolean, resultCode: number, method?: string, properties?: Object, measurements?: Object);
        private formatDependencyName(method, absoluteUrl);
    }
}
declare module Microsoft.ApplicationInsights {
    interface IConfig {
        instrumentationKey?: string;
        endpointUrl?: string;
        emitLineDelimitedJson?: boolean;
        accountId?: string;
        sessionRenewalMs?: number;
        sessionExpirationMs?: number;
        maxBatchSizeInBytes?: number;
        maxBatchInterval?: number;
        enableDebug?: boolean;
        disableExceptionTracking?: boolean;
        disableTelemetry?: boolean;
        verboseLogging?: boolean;
        diagnosticLogInterval?: number;
        samplingPercentage?: number;
        autoTrackPageVisitTime?: boolean;
        disableAjaxTracking?: boolean;
        overridePageViewDuration?: boolean;
        maxAjaxCallsPerView?: number;
        disableDataLossAnalysis?: boolean;
        disableCorrelationHeaders?: boolean;
        disableFlushOnBeforeUnload?: boolean;
        enableSessionStorageBuffer?: boolean;
        isCookieUseDisabled?: boolean;
        cookieDomain?: string;
        isRetryDisabled?: boolean;
        isPerfAnalyzerEnabled?: boolean;
        url?: string;
        isStorageUseDisabled?: boolean;
    }
}
declare module Microsoft.ApplicationInsights {
    interface IAppInsights {
        config: IConfig;
        context: ITelemetryContext;
        queue: (() => void)[];
        /**
        * Starts timing how long the user views a page or other item. Call this when the page opens.
        * This method doesn't send any telemetry. Call {@link stopTrackTelemetry} to log the page when it closes.
        * @param   name  A string that idenfities this item, unique within this HTML document. Defaults to the document title.
        */
        startTrackPage(name?: string): any;
        /**
        * Logs how long a page or other item was visible, after {@link startTrackPage}. Call this when the page closes.
        * @param   name  The string you used as the name in startTrackPage. Defaults to the document title.
        * @param   url   String - a relative or absolute URL that identifies the page or other item. Defaults to the window location.
        * @param   properties  map[string, string] - additional data used to filter pages and metrics in the portal. Defaults to empty.
        * @param   measurements    map[string, number] - metrics associated with this page, displayed in Metrics Explorer on the portal. Defaults to empty.
        */
        stopTrackPage(name?: string, url?: string, properties?: {
            [name: string]: string;
        }, measurements?: {
            [name: string]: number;
        }): any;
        /**
         * Logs that a page or other item was viewed.
         * @param   name  The string you used as the name in startTrackPage. Defaults to the document title.
         * @param   url   String - a relative or absolute URL that identifies the page or other item. Defaults to the window location.
         * @param   properties  map[string, string] - additional data used to filter pages and metrics in the portal. Defaults to empty.
         * @param   measurements    map[string, number] - metrics associated with this page, displayed in Metrics Explorer on the portal. Defaults to empty.
         * @param   duration    number - the number of milliseconds it took to load the page. Defaults to undefined. If set to default value, page load time is calculated internally.
         */
        trackPageView(name?: string, url?: string, properties?: {
            [name: string]: string;
        }, measurements?: {
            [name: string]: number;
        }, duration?: number): any;
        /**
         * Start timing an extended event. Call {@link stopTrackEvent} to log the event when it ends.
         * @param   name    A string that identifies this event uniquely within the document.
         */
        startTrackEvent(name: string): any;
        /**
         * Log an extended event that you started timing with {@link startTrackEvent}.
         * @param   name    The string you used to identify this event in startTrackEvent.
         * @param   properties  map[string, string] - additional data used to filter events and metrics in the portal. Defaults to empty.
         * @param   measurements    map[string, number] - metrics associated with this event, displayed in Metrics Explorer on the portal. Defaults to empty.
         */
        stopTrackEvent(name: string, properties?: {
            [name: string]: string;
        }, measurements?: {
            [name: string]: number;
        }): any;
        /**
        * Log a user action or other occurrence.
        * @param   name    A string to identify this event in the portal.
        * @param   properties  map[string, string] - additional data used to filter events and metrics in the portal. Defaults to empty.
        * @param   measurements    map[string, number] - metrics associated with this event, displayed in Metrics Explorer on the portal. Defaults to empty.
        */
        trackEvent(name: string, properties?: {
            [name: string]: string;
        }, measurements?: {
            [name: string]: number;
        }): any;
        /**
         * Log a dependency call
         * @param id    unique id, this is used by the backend o correlate server requests. Use Util.newId() to generate a unique Id.
         * @param method    represents request verb (GET, POST, etc.)
         * @param absoluteUrl   absolute url used to make the dependency request
         * @param pathName  the path part of the absolute url
         * @param totalTime total request time
         * @param success   indicates if the request was sessessful
         * @param resultCode    response code returned by the dependency request
         */
        trackDependency(id: string, method: string, absoluteUrl: string, pathName: string, totalTime: number, success: boolean, resultCode: number): any;
        /**
         * Log an exception you have caught.
         * @param   exception   An Error from a catch clause, or the string error message.
         * @param   properties  map[string, string] - additional data used to filter events and metrics in the portal. Defaults to empty.
         * @param   measurements    map[string, number] - metrics associated with this event, displayed in Metrics Explorer on the portal. Defaults to empty.
         * @param   severityLevel   AI.SeverityLevel - severity level
         */
        trackException(exception: Error, handledAt?: string, properties?: {
            [name: string]: string;
        }, measurements?: {
            [name: string]: number;
        }, severityLevel?: AI.SeverityLevel): any;
        /**
         * Log a numeric value that is not associated with a specific event. Typically used to send regular reports of performance indicators.
         * To send a single measurement, use just the first two parameters. If you take measurements very frequently, you can reduce the
         * telemetry bandwidth by aggregating multiple measurements and sending the resulting average at intervals.
         * @param   name    A string that identifies the metric.
         * @param   average Number representing either a single measurement, or the average of several measurements.
         * @param   sampleCount The number of measurements represented by the average. Defaults to 1.
         * @param   min The smallest measurement in the sample. Defaults to the average.
         * @param   max The largest measurement in the sample. Defaults to the average.
         */
        trackMetric(name: string, average: number, sampleCount?: number, min?: number, max?: number, properties?: {
            [name: string]: string;
        }): any;
        /**
        * Log a diagnostic message.
        * @param    message A message string
        * @param   properties  map[string, string] - additional data used to filter traces in the portal. Defaults to empty.
        */
        trackTrace(message: string, properties?: {
            [name: string]: string;
        }): any;
        /**
         * Immediately send all queued telemetry.
         */
        flush(): any;
        /**
        * Sets the autheticated user id and the account id in this session.
        * User auth id and account id should be of type string. They should not contain commas, semi-colons, equal signs, spaces, or vertical-bars.
        *
        * @param authenticatedUserId {string} - The authenticated user id. A unique and persistent string that represents each authenticated user in the service.
        * @param accountId {string} - An optional string to represent the account associated with the authenticated user.
        */
        setAuthenticatedUserContext(authenticatedUserId: string, accountId?: string): any;
        /**
         * Clears the authenticated user id and the account id from the user context.
         */
        clearAuthenticatedUserContext(): any;
        downloadAndSetup?(config: Microsoft.ApplicationInsights.IConfig): void;
        /**
         * The custom error handler for Application Insights
         * @param {string} message - The error message
         * @param {string} url - The url where the error was raised
         * @param {number} lineNumber - The line number where the error was raised
         * @param {number} columnNumber - The column number for the line where the error was raised
         * @param {Error}  error - The Error object
         */
        _onerror(message: string, url: string, lineNumber: number, columnNumber: number, error: Error): any;
    }
}
declare module Microsoft.ApplicationInsights {
    var Version: string;
    var SnippetVersion: string;
    /**
    * Internal interface to pass appInsights object to subcomponents without coupling
    */
    interface IAppInsightsInternal {
        sendPageViewInternal(name?: string, url?: string, duration?: number, properties?: Object, measurements?: Object): any;
        sendPageViewPerformanceInternal(pageViewPerformance: ApplicationInsights.Telemetry.PageViewPerformance): any;
        flush(): any;
    }
    /**
     * The main API that sends telemetry to Application Insights.
     * Learn more: http://go.microsoft.com/fwlink/?LinkID=401493
     */
    class AppInsights implements IAppInsightsInternal, IAppInsights {
        private _trackAjaxAttempts;
        private _eventTracking;
        private _pageTracking;
        private _pageViewManager;
        private _pageVisitTimeManager;
        private _performanceAnalyzer;
        config: IConfig;
        context: TelemetryContext;
        queue: (() => void)[];
        static defaultConfig: IConfig;
        constructor(config: IConfig);
        sendPageViewInternal(name?: string, url?: string, duration?: number, properties?: Object, measurements?: Object): void;
        sendPageViewPerformanceInternal(pageViewPerformance: ApplicationInsights.Telemetry.PageViewPerformance): void;
        /**
         * Starts timing how long the user views a page or other item. Call this when the page opens.
         * This method doesn't send any telemetry. Call {@link stopTrackTelemetry} to log the page when it closes.
         * @param   name  A string that idenfities this item, unique within this HTML document. Defaults to the document title.
         */
        startTrackPage(name?: string): void;
        /**
         * Logs how long a page or other item was visible, after {@link startTrackPage}. Call this when the page closes.
         * @param   name  The string you used as the name in startTrackPage. Defaults to the document title.
         * @param   url   String - a relative or absolute URL that identifies the page or other item. Defaults to the window location.
         * @param   properties  map[string, string] - additional data used to filter pages and metrics in the portal. Defaults to empty.
         * @param   measurements    map[string, number] - metrics associated with this page, displayed in Metrics Explorer on the portal. Defaults to empty.
         */
        stopTrackPage(name?: string, url?: string, properties?: Object, measurements?: Object): void;
        /**
         * Logs that a page or other item was viewed.
         * @param   name  The string you used as the name in startTrackPage. Defaults to the document title.
         * @param   url   String - a relative or absolute URL that identifies the page or other item. Defaults to the window location.
         * @param   properties  map[string, string] - additional data used to filter pages and metrics in the portal. Defaults to empty.
         * @param   measurements    map[string, number] - metrics associated with this page, displayed in Metrics Explorer on the portal. Defaults to empty.
         * @param   duration    number - the number of milliseconds it took to load the page. Defaults to undefined. If set to default value, page load time is calculated internally.
         */
        trackPageView(name?: string, url?: string, properties?: Object, measurements?: Object, duration?: number): void;
        /**
         * Start timing an extended event. Call {@link stopTrackEvent} to log the event when it ends.
         * @param   name    A string that identifies this event uniquely within the document.
         */
        startTrackEvent(name: string): void;
        /**
         * Log an extended event that you started timing with {@link startTrackEvent}.
         * @param   name    The string you used to identify this event in startTrackEvent.
         * @param   properties  map[string, string] - additional data used to filter events and metrics in the portal. Defaults to empty.
         * @param   measurements    map[string, number] - metrics associated with this event, displayed in Metrics Explorer on the portal. Defaults to empty.
         */
        stopTrackEvent(name: string, properties?: Object, measurements?: Object): void;
        /**
         * Log a user action or other occurrence.
         * @param   name    A string to identify this event in the portal.
         * @param   properties  map[string, string] - additional data used to filter events and metrics in the portal. Defaults to empty.
         * @param   measurements    map[string, number] - metrics associated with this event, displayed in Metrics Explorer on the portal. Defaults to empty.
         */
        trackEvent(name: string, properties?: Object, measurements?: Object): void;
        /**
         * Log a dependency call
         * @param id    unique id, this is used by the backend o correlate server requests. Use Util.newId() to generate a unique Id.
         * @param method    represents request verb (GET, POST, etc.)
         * @param absoluteUrl   absolute url used to make the dependency request
         * @param pathName  the path part of the absolute url
         * @param totalTime total request time
         * @param success   indicates if the request was sessessful
         * @param resultCode    response code returned by the dependency request
         * @param properties    map[string, string] - additional data used to filter events and metrics in the portal. Defaults to empty.
         * @param measurements  map[string, number] - metrics associated with this event, displayed in Metrics Explorer on the portal. Defaults to empty.
         */
        trackDependency(id: string, method: string, absoluteUrl: string, pathName: string, totalTime: number, success: boolean, resultCode: number, properties?: Object, measurements?: Object): void;
        /**
         * trackAjax method is obsolete, use trackDependency instead
         */
        trackAjax(id: string, absoluteUrl: string, pathName: string, totalTime: number, success: boolean, resultCode: number, method?: string): void;
        /**
         * Log an exception you have caught.
         * @param   exception   An Error from a catch clause, or the string error message.
         * @param   properties  map[string, string] - additional data used to filter events and metrics in the portal. Defaults to empty.
         * @param   measurements    map[string, number] - metrics associated with this event, displayed in Metrics Explorer on the portal. Defaults to empty.
         * @param   severityLevel   AI.SeverityLevel - severity level
         */
        trackException(exception: Error, handledAt?: string, properties?: Object, measurements?: Object, severityLevel?: AI.SeverityLevel): void;
        /**
         * Log a numeric value that is not associated with a specific event. Typically used to send regular reports of performance indicators.
         * To send a single measurement, use just the first two parameters. If you take measurements very frequently, you can reduce the
         * telemetry bandwidth by aggregating multiple measurements and sending the resulting average at intervals.
         * @param   name    A string that identifies the metric.
         * @param   average Number representing either a single measurement, or the average of several measurements.
         * @param   sampleCount The number of measurements represented by the average. Defaults to 1.
         * @param   min The smallest measurement in the sample. Defaults to the average.
         * @param   max The largest measurement in the sample. Defaults to the average.
         */
        trackMetric(name: string, average: number, sampleCount?: number, min?: number, max?: number, properties?: Object): void;
        /**
        * Log a diagnostic message.
        * @param    message A message string
        * @param   properties  map[string, string] - additional data used to filter traces in the portal. Defaults to empty.
        */
        trackTrace(message: string, properties?: Object): void;
        /**
       * Log a page visit time
       * @param    pageName    Name of page
       * @param    pageVisitDuration Duration of visit to the page in milleseconds
       */
        private trackPageVisitTime(pageName, pageUrl, pageVisitTime);
        /**
         * Immediately send all queued telemetry.
         */
        flush(): void;
        /**
         * Sets the autheticated user id and the account id in this session.
         * User auth id and account id should be of type string. They should not contain commas, semi-colons, equal signs, spaces, or vertical-bars.
         *
         * @param authenticatedUserId {string} - The authenticated user id. A unique and persistent string that represents each authenticated user in the service.
         * @param accountId {string} - An optional string to represent the account associated with the authenticated user.
         */
        setAuthenticatedUserContext(authenticatedUserId: string, accountId?: string): void;
        /**
         * Clears the authenticated user id and the account id from the user context.
         */
        clearAuthenticatedUserContext(): void;
        /**
        * In case of CORS exceptions - construct an exception manually.
        * See this for more info: http://stackoverflow.com/questions/5913978/cryptic-script-error-reported-in-javascript-in-chrome-and-firefox
        */
        private SendCORSException(properties);
        /**
         * The custom error handler for Application Insights
         * @param {string} message - The error message
         * @param {string} url - The url where the error was raised
         * @param {number} lineNumber - The line number where the error was raised
         * @param {number} columnNumber - The column number for the line where the error was raised
         * @param {Error}  error - The Error object
         */
        _onerror(message: string, url: string, lineNumber: number, columnNumber: number, error: Error): void;
    }
}
declare module Microsoft.ApplicationInsights {
    interface Snippet {
        queue: Array<() => void>;
        config: IConfig;
        version: string;
    }
    class Initialization {
        snippet: Snippet;
        config: IConfig;
        constructor(snippet: Snippet);
        loadAppInsights(): AppInsights;
        emptyQueue(): void;
        pollInteralLogs(appInsightsInstance: AppInsights): number;
        addHousekeepingBeforeUnload(appInsightsInstance: AppInsights): void;
        static getDefaultConfig(config?: IConfig): IConfig;
    }
}
declare module Microsoft.ApplicationInsights {
}
declare module AI {
    class AjaxCallData extends AI.PageViewData {
        ver: number;
        url: string;
        ajaxUrl: string;
        name: string;
        duration: string;
        requestSize: number;
        referrer: string;
        responseSize: number;
        referrerData: string;
        timeToFirstByte: string;
        timeToLastByte: string;
        callbackDuration: string;
        responseCode: string;
        success: boolean;
        properties: any;
        measurements: any;
        constructor();
    }
}
declare module AI {
    class RequestData extends Microsoft.Telemetry.Domain {
        ver: number;
        id: string;
        name: string;
        startTime: string;
        duration: string;
        responseCode: string;
        success: boolean;
        httpMethod: string;
        url: string;
        properties: any;
        measurements: any;
        constructor();
    }
}
declare module AI {
    class SessionStateData extends Microsoft.Telemetry.Domain {
        ver: number;
        state: AI.SessionState;
        constructor();
    }
}
declare module AI {
    enum TestResult {
        Pass = 0,
        Fail = 1,
    }
}
