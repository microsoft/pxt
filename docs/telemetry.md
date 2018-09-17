# Telemetry collected by Microsoft MakeCode

Client side telemetry is collected for Microsoft MakeCode [websites](https://makecode.com).

Microsoft MakeCode uses the [Application Insights Javascript SDK](https://github.com/Microsoft/ApplicationInsights-JS) to collect the telemetry information.

## Cookies

There are two types of cookies stored by Microsoft MakeCode.

- Language selection cookie. This is used to persist the language selection by user across sessions (Examples: English, French or German).
- Application Insight cookie for user tracking. This is used to correlate the data across sessions.

There's no authentication in MakeCode and it doesn't perform any authenticated user tracking or use cookies to identify authenticated users.

## Application Insights SDK Telemetry

Here's the lifetime of the data tracked by Application Insights:

 |Name |Purpose|	Domain|	R/W|	Expiration|	Retires|
|-----|-------|-------|-------|-----|-------|
|`ai_session`|	Session tracking|	Hosting website|	R/W	|30 minutes|	End of session|
|`ai_user`|	User tracking|	Hosting website|	R/W|	365 days|	Never|


### Telemetry Details

The following sections contain the information that the Application Insights SDK attempts to extract from the environment about the device, location, and user.

#### Device telemetry

The device (workstation, laptop, mobile device, etc.) the website is running on.

Property | Description
---|---
`device.type`  | Type of device
`device.id`	| unique ID
`device.oemName` |
`device.model` |
`device.network` | number  - IANA interface type
`device.resolution`  | screen resolution
`device.locale` | display language of the OS
`device.ip` | last 8 bits zeroed out to anonymise
`device.language` |
`device.os` |  OS running on the device
`device.osversion` |

#### User telemetry

Data about the current user. Users are identified by a cookie, so a single person can look like
more than one user in the telemetry if they use different machines or browsers, or delete cookies.

Property | Description
---|---
`user.id` | Unique, cookie-based user id, automatically assigned.
`user.authenticatedId` | Not used by Microsoft MakeCode
`user.accountId` | Not used by Microsoft MakeCode
`user.accountAcquisitionDate` |
`user.agent` |
`user.storeRegion` |


#### User Session telemetry

A session represents a series of user actions. A session starts with a user action. Sessions expire when one of these conditions occurs:

* 30 minutes of inactivity.
* A session maximum duration of 24 hours, regardless of any measured activity.

Property | Description
---|---
`session.id` | Automatically assigned id
`session.isFirst` | Boolean. True if this is the first session for this user.
`session.acquisitionDate` | Number. The dateTime when this session was created.
`session.renewalDate` | Number. DateTime when telemetry was last sent with this session.

#### Location telemetry

The estimated geographical location of the user's device. The last 8 bits of IP address are sanitized to zero by Application insights.

Property | Description
---|---
`location.ip` | IP address

#### Operation telemetry

Represents the user request. The operation id is used to correlate related events in a diagnostic search.

Property | Description
---|---
`id` | Unique id
`name` |
`parentId` |
`rootId` |
`syntheticSource` | String identifying the bot or test agent.

<br/>
**Note:** Refer to the [Application Insights SDK API Reference](https://github.com/Microsoft/ApplicationInsights-JS/blob/master/API-reference.md) documentation for further details.

## Microsoft MakeCode custom telemetry

Microsoft MakeCode website's also sends custom telemetry using AppInsights [trackEvent](https://github.com/Microsoft/ApplicationInsights-JS/blob/master/API-reference.md#trackevent). Each custom telemetry event has the following additional information:

CustomDimensions | Description
---|---
`version` | Version of the software
`target` | Identifies the target. For example: [microbit](makecode.microbit.org) or [adafruit CPX](makecode.adafruit.com)
`stage` | beta, release or alpha
`WindowsApp` | Event originates from Windows App for Microsoft MakeCode
`electron` | Event originates from electron app
<br/>
These are the custom telemetry events fired by MakeCode editors:

Events | Description
-------|-------
Block | blocks used, search, collapse, expand, delete, format, screenshot,help, switchjavascript, showjavascript, category, block type
Editor tools| Rename, download, save, undo, zoomIn, zoomOut, startStopSimulator, restart, trace, toggleCollapse
Menu | Javascript tab, Blocks tab, open, add package, reset, report abuse, gettingstarted, about, high contrast etc
Typescript | keep text, discard text, toolbox click, item click, item drag
Projects | new porject, rename, import, import url, tutorials
Simulator | Start, stop, restart, fullscreen, screen, mute, make, screenshot
Hex files | import success\failure,
Share | publish, facebook, twitter
Compile | Noemit, floating point information
locale | change of language
Packages | github search, bundled,
Docs | doc usage
<br/>
In addition to the events, exceptions in the editor are sent by AppInsights [trackException](https://github.com/Microsoft/ApplicationInsights-JS/blob/master/API-reference.md#trackexception).
