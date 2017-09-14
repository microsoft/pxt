# Telemetry collected by Microsoft MakeCode

This writeup documents the client side telemetry collected by Microsoft MakeCode websites such as [micro:bit](https://makecode.microbit.org), [adafruit](https://makecode.adafruit.org), [MakeCode for Minecaft](https://minecraft.makecode.com) and [MakeCode.com](https://makecode.com). Microsoft MakeCode uses Application Insights Javascript [SDK](https://github.com/Microsoft/ApplicationInsights-JS) for all the telemetry.

## Cookie

 There are two types of cookies stored by Microsoft MakeCode.
- Language selection cookie. This is used to persist the language selection  by the user across sessions (Example English, French or German).
- Application Insight cookie for user tracking. This is used to correlate the data across sessions.

There is no authentication in MakeCode and it doesn't do authenticated user tracking or any cookie to identify the authenticated users.

## Application Insights SDK Telemetry

Following is the lifetime of the data in the application insights.

 |Name |Purpose|	Domain|	R/W|	Expiration|	Retires|
|-----|-------|-------|-------|-----|-------|
|ai_session|	Session tracking|	Hosting website|	R/W	|30 minutes|	End of session|
|ai_user|	User tracking|	Hosting website|	R/W|	365 days|	Never|


### Telemetry Details

Following section contains the information that the Application SDK attempts to extract from the environment about the device, location, and user. 

 ### Device telemetry

The device the website is running on.
  
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

### User telemetry

Data about the current user. Users are identified by cookie, so one person can look like 
more than one user if they use different machines or browsers, or delete cookies.

Property | Description
---|---
`user.id` | Unique, cookie-based user id, automatically assigned.
`user.authenticatedId` | Not used by Microsoft MakeCode
`user.accountId` | Not used by Microsoft MakeCode
`user.accountAcquisitionDate` |
`user.agent` | 
`user.storeRegion` | 


### User Session telemetry
    
A session represents a series of user actions. A session starts with a user action.
It ends at the last user activity when there is no more activity for 30 minutes, or if it lasts longer than 30 minutes.

Property | Description
---|---
`session.id` | Automatically assigned id
`session.isFirst` | Boolean. True if this is the first session for this user.
`session.acquisitionDate` | Number. The dateTime when this session was created.
`session.renewalDate` | Number. DateTime when telemetry was last sent with this session.

### Location telemetry

Data from which the geographical location of the user's device can be guessed. Last 8 bits of ip address are sanitized to zero by Application insights.

Property | Description
---|---
`location.ip` | IP address

### Operation telemetry
     
Represents the user request. Operation id is used to tie together related events in diagnostic search.

Property | Description
---|---
`id` | Unique id
`name` | 
`parentId` |
`rootId` |
`syntheticSource` | String identifying the bot or test agent.

Note: Please refer Application insights SDK documentation for further details: https://github.com/Microsoft/ApplicationInsights-JS/edit/master/API-reference.md

## Microsoft MakeCode custom telemetry 

Microsoft MakeCode website's also send custom telemetry using AppInsights [trackEvent](https://github.com/Microsoft/ApplicationInsights-JS/blob/master/API-reference.md#trackevent). Each custom telemetry event will have additional following information:

CustomDimensions | Description
---|---
`version` | Version of the software
`target` | Identifies the target. For example: [microbit](makecode.microbit.org) or [adafruit CPX](makecode.adafruit.com)
`stage` | beta, release or alpha
`WindowsApp` | Event originates from Windows App for Microsoft MakeCode
`electron` | Event originates from electron app

Following are the custom telemetry events fired by MakeCode editors

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

Apart from this exceptions in the editor are sent through AppInsights [trackException](https://github.com/Microsoft/ApplicationInsights-JS/blob/master/API-reference.md#trackexception).
