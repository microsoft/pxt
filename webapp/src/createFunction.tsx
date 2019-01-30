/// <reference path="../../built/pxtlib.d.ts" />

import * as React from "react";
import * as data from "./data";
import * as sui from "./sui";
import * as codecard from "./codecard"

type ISettingsProps = pxt.editor.ISettingsProps;

export interface CreateFunctionDialogState {
    visible?: boolean;
    functionEditorWorkspace?: Blockly.Workspace;
    functionCallback?: Blockly.Functions.ConfirmEditCallback;
    initialMutation?: Element;
    functionBeingEdited?: Blockly.FunctionDeclarationBlock;
    mainWorkspace?: Blockly.Workspace;
}

export class CreateFunctionDialog extends data.Component<ISettingsProps, CreateFunctionDialogState> {
    static cachedFunctionTypes: pxt.FunctionEditorTypeInfo[] = null;
    static booleanArgIcon = "data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiIHN0YW5kYWxvbmU9Im5vIj8+CjxzdmcKICAgeG1sbnM6ZGM9Imh0dHA6Ly9wdXJsLm9yZy9kYy9lbGVtZW50cy8xLjEvIgogICB4bWxuczpjYz0iaHR0cDovL2NyZWF0aXZlY29tbW9ucy5vcmcvbnMjIgogICB4bWxuczpyZGY9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkvMDIvMjItcmRmLXN5bnRheC1ucyMiCiAgIHhtbG5zOnN2Zz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciCiAgIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIKICAgaWQ9InN2ZzgiCiAgIHZlcnNpb249IjEuMSIKICAgdmlld0JveD0iMCAwIDE0LjUzMTQxMiA2LjExODQ4OTMiCiAgIGhlaWdodD0iNi4xMTg0ODkzbW0iCiAgIHdpZHRoPSIxNC41MzE0MTJtbSI+CiAgPGRlZnMKICAgICBpZD0iZGVmczIiIC8+CiAgPG1ldGFkYXRhCiAgICAgaWQ9Im1ldGFkYXRhNSI+CiAgICA8cmRmOlJERj4KICAgICAgPGNjOldvcmsKICAgICAgICAgcmRmOmFib3V0PSIiPgogICAgICAgIDxkYzpmb3JtYXQ+aW1hZ2Uvc3ZnK3htbDwvZGM6Zm9ybWF0PgogICAgICAgIDxkYzp0eXBlCiAgICAgICAgICAgcmRmOnJlc291cmNlPSJodHRwOi8vcHVybC5vcmcvZGMvZGNtaXR5cGUvU3RpbGxJbWFnZSIgLz4KICAgICAgICA8ZGM6dGl0bGU+PC9kYzp0aXRsZT4KICAgICAgPC9jYzpXb3JrPgogICAgPC9yZGY6UkRGPgogIDwvbWV0YWRhdGE+CiAgPGcKICAgICB0cmFuc2Zvcm09InRyYW5zbGF0ZSgtOTguNzM5NDAzLC0xNDYuMTIwMykiCiAgICAgaWQ9ImxheWVyMSI+CiAgICA8dGV4dAogICAgICAgaWQ9InRleHQzNzE1IgogICAgICAgeT0iMTUyLjIzODc4IgogICAgICAgeD0iOTcuNTkyMTg2IgogICAgICAgc3R5bGU9ImZvbnQtc3R5bGU6bm9ybWFsO2ZvbnQtdmFyaWFudDpub3JtYWw7Zm9udC13ZWlnaHQ6Ym9sZDtmb250LXN0cmV0Y2g6Y29uZGVuc2VkO2ZvbnQtc2l6ZToxMC41ODMzMzMwMnB4O2xpbmUtaGVpZ2h0OjEuMjU7Zm9udC1mYW1pbHk6J0FyaWFsIE5hcnJvdyc7LWlua3NjYXBlLWZvbnQtc3BlY2lmaWNhdGlvbjonQXJpYWwgTmFycm93LCBCb2xkIENvbmRlbnNlZCc7Zm9udC12YXJpYW50LWxpZ2F0dXJlczpub3JtYWw7Zm9udC12YXJpYW50LWNhcHM6bm9ybWFsO2ZvbnQtdmFyaWFudC1udW1lcmljOm5vcm1hbDtmb250LWZlYXR1cmUtc2V0dGluZ3M6bm9ybWFsO3RleHQtYWxpZ246c3RhcnQ7bGV0dGVyLXNwYWNpbmc6MHB4O3dvcmQtc3BhY2luZzowcHg7d3JpdGluZy1tb2RlOmxyLXRiO3RleHQtYW5jaG9yOnN0YXJ0O2ZpbGw6IzAwMDAwMDtmaWxsLW9wYWNpdHk6MTtzdHJva2U6bm9uZTtzdHJva2Utd2lkdGg6MC4yNjQ1ODMzMiIKICAgICAgIHhtbDpzcGFjZT0icHJlc2VydmUiPjx0c3BhbgogICAgICAgICB5PSIxNTIuMjM4NzgiCiAgICAgICAgIHg9Ijk3LjU5MjE4NiIKICAgICAgICAgaWQ9InRzcGFuMzcyOSI+4oqk4oqlPC90c3Bhbj48L3RleHQ+CiAgPC9nPgo8L3N2Zz4K";
    static booleanArgCardImage = "data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiIHN0YW5kYWxvbmU9Im5vIj8+CjxzdmcKICAgeG1sbnM6ZGM9Imh0dHA6Ly9wdXJsLm9yZy9kYy9lbGVtZW50cy8xLjEvIgogICB4bWxuczpjYz0iaHR0cDovL2NyZWF0aXZlY29tbW9ucy5vcmcvbnMjIgogICB4bWxuczpyZGY9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkvMDIvMjItcmRmLXN5bnRheC1ucyMiCiAgIHhtbG5zOnN2Zz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciCiAgIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIKICAgaWQ9InN2ZzgiCiAgIHZlcnNpb249IjEuMSIKICAgdmlld0JveD0iMCAwIDMwIDE5Ljk5OTk5OSIKICAgaGVpZ2h0PSIyY20iCiAgIHdpZHRoPSIzY20iPgogIDxkZWZzCiAgICAgaWQ9ImRlZnMyIiAvPgogIDxtZXRhZGF0YQogICAgIGlkPSJtZXRhZGF0YTUiPgogICAgPHJkZjpSREY+CiAgICAgIDxjYzpXb3JrCiAgICAgICAgIHJkZjphYm91dD0iIj4KICAgICAgICA8ZGM6Zm9ybWF0PmltYWdlL3N2Zyt4bWw8L2RjOmZvcm1hdD4KICAgICAgICA8ZGM6dHlwZQogICAgICAgICAgIHJkZjpyZXNvdXJjZT0iaHR0cDovL3B1cmwub3JnL2RjL2RjbWl0eXBlL1N0aWxsSW1hZ2UiIC8+CiAgICAgICAgPGRjOnRpdGxlPjwvZGM6dGl0bGU+CiAgICAgIDwvY2M6V29yaz4KICAgIDwvcmRmOlJERj4KICA8L21ldGFkYXRhPgogIDxnCiAgICAgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoLTk4LjczOTQwMywtMTMyLjIzODgzKSIKICAgICBpZD0ibGF5ZXIxIj4KICAgIDx0ZXh0CiAgICAgICBpZD0idGV4dDM3MTUiCiAgICAgICB5PSIxNDUuMjk4MDgiCiAgICAgICB4PSIxMDUuMzI2NDgiCiAgICAgICBzdHlsZT0iZm9udC1zdHlsZTpub3JtYWw7Zm9udC12YXJpYW50Om5vcm1hbDtmb250LXdlaWdodDpib2xkO2ZvbnQtc3RyZXRjaDpjb25kZW5zZWQ7Zm9udC1zaXplOjEwLjU4MzMzMzAycHg7bGluZS1oZWlnaHQ6MS4yNTtmb250LWZhbWlseTonQXJpYWwgTmFycm93JzstaW5rc2NhcGUtZm9udC1zcGVjaWZpY2F0aW9uOidBcmlhbCBOYXJyb3csIEJvbGQgQ29uZGVuc2VkJztmb250LXZhcmlhbnQtbGlnYXR1cmVzOm5vcm1hbDtmb250LXZhcmlhbnQtY2Fwczpub3JtYWw7Zm9udC12YXJpYW50LW51bWVyaWM6bm9ybWFsO2ZvbnQtZmVhdHVyZS1zZXR0aW5nczpub3JtYWw7dGV4dC1hbGlnbjpzdGFydDtsZXR0ZXItc3BhY2luZzowcHg7d29yZC1zcGFjaW5nOjBweDt3cml0aW5nLW1vZGU6bHItdGI7dGV4dC1hbmNob3I6c3RhcnQ7ZmlsbDojMDAwMDAwO2ZpbGwtb3BhY2l0eToxO3N0cm9rZTpub25lO3N0cm9rZS13aWR0aDowLjI2NDU4MzMyIgogICAgICAgeG1sOnNwYWNlPSJwcmVzZXJ2ZSI+PHRzcGFuCiAgICAgICAgIHk9IjE0NS4yOTgwOCIKICAgICAgICAgeD0iMTA1LjMyNjQ4IgogICAgICAgICBpZD0idHNwYW4zNzI5Ij7iiqTiiqU8L3RzcGFuPjwvdGV4dD4KICA8L2c+Cjwvc3ZnPgo=";
    static numberArgIcon = "data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiIHN0YW5kYWxvbmU9Im5vIj8+CjxzdmcKICAgeG1sbnM6ZGM9Imh0dHA6Ly9wdXJsLm9yZy9kYy9lbGVtZW50cy8xLjEvIgogICB4bWxuczpjYz0iaHR0cDovL2NyZWF0aXZlY29tbW9ucy5vcmcvbnMjIgogICB4bWxuczpyZGY9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkvMDIvMjItcmRmLXN5bnRheC1ucyMiCiAgIHhtbG5zOnN2Zz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciCiAgIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIKICAgaWQ9InN2ZzgiCiAgIHZlcnNpb249IjEuMSIKICAgdmlld0JveD0iMCAwIDEzLjQ0MTA0IDcuNzM1OTYxOSIKICAgaGVpZ2h0PSI3LjczNTk2MTltbSIKICAgd2lkdGg9IjEzLjQ0MTA0bW0iPgogIDxkZWZzCiAgICAgaWQ9ImRlZnMyIiAvPgogIDxtZXRhZGF0YQogICAgIGlkPSJtZXRhZGF0YTUiPgogICAgPHJkZjpSREY+CiAgICAgIDxjYzpXb3JrCiAgICAgICAgIHJkZjphYm91dD0iIj4KICAgICAgICA8ZGM6Zm9ybWF0PmltYWdlL3N2Zyt4bWw8L2RjOmZvcm1hdD4KICAgICAgICA8ZGM6dHlwZQogICAgICAgICAgIHJkZjpyZXNvdXJjZT0iaHR0cDovL3B1cmwub3JnL2RjL2RjbWl0eXBlL1N0aWxsSW1hZ2UiIC8+CiAgICAgICAgPGRjOnRpdGxlPjwvZGM6dGl0bGU+CiAgICAgIDwvY2M6V29yaz4KICAgIDwvcmRmOlJERj4KICA8L21ldGFkYXRhPgogIDxnCiAgICAgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoLTk4LjI3OTQ4MywtMTQ0LjYzMjAxKSIKICAgICBpZD0ibGF5ZXIxIj4KICAgIDx0ZXh0CiAgICAgICBpZD0idGV4dDM3MTUiCiAgICAgICB5PSIxNTIuMjM4NzgiCiAgICAgICB4PSI5Ny41OTIxODYiCiAgICAgICBzdHlsZT0iZm9udC1zdHlsZTpub3JtYWw7Zm9udC12YXJpYW50Om5vcm1hbDtmb250LXdlaWdodDpib2xkO2ZvbnQtc3RyZXRjaDpjb25kZW5zZWQ7Zm9udC1zaXplOjEwLjU4MzMzMzAycHg7bGluZS1oZWlnaHQ6MS4yNTtmb250LWZhbWlseTonQXJpYWwgTmFycm93JzstaW5rc2NhcGUtZm9udC1zcGVjaWZpY2F0aW9uOidBcmlhbCBOYXJyb3csIEJvbGQgQ29uZGVuc2VkJztmb250LXZhcmlhbnQtbGlnYXR1cmVzOm5vcm1hbDtmb250LXZhcmlhbnQtY2Fwczpub3JtYWw7Zm9udC12YXJpYW50LW51bWVyaWM6bm9ybWFsO2ZvbnQtZmVhdHVyZS1zZXR0aW5nczpub3JtYWw7dGV4dC1hbGlnbjpzdGFydDtsZXR0ZXItc3BhY2luZzowcHg7d29yZC1zcGFjaW5nOjBweDt3cml0aW5nLW1vZGU6bHItdGI7dGV4dC1hbmNob3I6c3RhcnQ7ZmlsbDojMDAwMDAwO2ZpbGwtb3BhY2l0eToxO3N0cm9rZTpub25lO3N0cm9rZS13aWR0aDowLjI2NDU4MzMyIgogICAgICAgeG1sOnNwYWNlPSJwcmVzZXJ2ZSI+PHRzcGFuCiAgICAgICAgIHN0eWxlPSJmb250LXN0eWxlOm5vcm1hbDtmb250LXZhcmlhbnQ6bm9ybWFsO2ZvbnQtd2VpZ2h0OmJvbGQ7Zm9udC1zdHJldGNoOmNvbmRlbnNlZDtmb250LXNpemU6MTAuNTgzMzMzMDJweDtmb250LWZhbWlseTonQXJpYWwgTmFycm93JzstaW5rc2NhcGUtZm9udC1zcGVjaWZpY2F0aW9uOidBcmlhbCBOYXJyb3csIEJvbGQgQ29uZGVuc2VkJztmb250LXZhcmlhbnQtbGlnYXR1cmVzOm5vcm1hbDtmb250LXZhcmlhbnQtY2Fwczpub3JtYWw7Zm9udC12YXJpYW50LW51bWVyaWM6bm9ybWFsO2ZvbnQtZmVhdHVyZS1zZXR0aW5nczpub3JtYWw7dGV4dC1hbGlnbjpzdGFydDt3cml0aW5nLW1vZGU6bHItdGI7dGV4dC1hbmNob3I6c3RhcnQ7c3Ryb2tlLXdpZHRoOjAuMjY0NTgzMzIiCiAgICAgICAgIHk9IjE1Mi4yMzg3OCIKICAgICAgICAgeD0iOTcuNTkyMTg2IgogICAgICAgICBpZD0idHNwYW4zNzEzIj4xMjM8L3RzcGFuPjwvdGV4dD4KICA8L2c+Cjwvc3ZnPgo=";
    static numberArgCardImage = "data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiIHN0YW5kYWxvbmU9Im5vIj8+CjxzdmcKICAgeG1sbnM6ZGM9Imh0dHA6Ly9wdXJsLm9yZy9kYy9lbGVtZW50cy8xLjEvIgogICB4bWxuczpjYz0iaHR0cDovL2NyZWF0aXZlY29tbW9ucy5vcmcvbnMjIgogICB4bWxuczpyZGY9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkvMDIvMjItcmRmLXN5bnRheC1ucyMiCiAgIHhtbG5zOnN2Zz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciCiAgIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIKICAgd2lkdGg9IjNjbSIKICAgaGVpZ2h0PSIyY20iCiAgIHZpZXdCb3g9IjAgMCAyOS45OTk5OTkgMjAuMDAwMDAxIgogICB2ZXJzaW9uPSIxLjEiCiAgIGlkPSJzdmc4Ij4KICA8ZGVmcwogICAgIGlkPSJkZWZzMiIgLz4KICA8bWV0YWRhdGEKICAgICBpZD0ibWV0YWRhdGE1Ij4KICAgIDxyZGY6UkRGPgogICAgICA8Y2M6V29yawogICAgICAgICByZGY6YWJvdXQ9IiI+CiAgICAgICAgPGRjOmZvcm1hdD5pbWFnZS9zdmcreG1sPC9kYzpmb3JtYXQ+CiAgICAgICAgPGRjOnR5cGUKICAgICAgICAgICByZGY6cmVzb3VyY2U9Imh0dHA6Ly9wdXJsLm9yZy9kYy9kY21pdHlwZS9TdGlsbEltYWdlIiAvPgogICAgICAgIDxkYzp0aXRsZT48L2RjOnRpdGxlPgogICAgICA8L2NjOldvcms+CiAgICA8L3JkZjpSREY+CiAgPC9tZXRhZGF0YT4KICA8ZwogICAgIGlkPSJsYXllcjEiCiAgICAgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoLTkwLjAwMDAwMywtMTM4LjUpIj4KICAgIDx0ZXh0CiAgICAgICB4bWw6c3BhY2U9InByZXNlcnZlIgogICAgICAgc3R5bGU9ImZvbnQtc3R5bGU6bm9ybWFsO2ZvbnQtdmFyaWFudDpub3JtYWw7Zm9udC13ZWlnaHQ6Ym9sZDtmb250LXN0cmV0Y2g6Y29uZGVuc2VkO2ZvbnQtc2l6ZToxMC41ODMzMzMwMnB4O2xpbmUtaGVpZ2h0OjEuMjU7Zm9udC1mYW1pbHk6J0FyaWFsIE5hcnJvdyc7LWlua3NjYXBlLWZvbnQtc3BlY2lmaWNhdGlvbjonQXJpYWwgTmFycm93LCBCb2xkIENvbmRlbnNlZCc7Zm9udC12YXJpYW50LWxpZ2F0dXJlczpub3JtYWw7Zm9udC12YXJpYW50LWNhcHM6bm9ybWFsO2ZvbnQtdmFyaWFudC1udW1lcmljOm5vcm1hbDtmb250LWZlYXR1cmUtc2V0dGluZ3M6bm9ybWFsO3RleHQtYWxpZ246c3RhcnQ7bGV0dGVyLXNwYWNpbmc6MHB4O3dvcmQtc3BhY2luZzowcHg7d3JpdGluZy1tb2RlOmxyLXRiO3RleHQtYW5jaG9yOnN0YXJ0O2ZpbGw6IzAwMDAwMDtmaWxsLW9wYWNpdHk6MTtzdHJva2U6bm9uZTtzdHJva2Utd2lkdGg6MC4yNjQ1ODMzMiIKICAgICAgIHg9Ijk3LjU5MjE4NiIKICAgICAgIHk9IjE1Mi4yMzg3OCIKICAgICAgIGlkPSJ0ZXh0MzcxNSI+PHRzcGFuCiAgICAgICAgIGlkPSJ0c3BhbjM3MTMiCiAgICAgICAgIHg9Ijk3LjU5MjE4NiIKICAgICAgICAgeT0iMTUyLjIzODc4IgogICAgICAgICBzdHlsZT0iZm9udC1zdHlsZTpub3JtYWw7Zm9udC12YXJpYW50Om5vcm1hbDtmb250LXdlaWdodDpib2xkO2ZvbnQtc3RyZXRjaDpjb25kZW5zZWQ7Zm9udC1zaXplOjEwLjU4MzMzMzAycHg7Zm9udC1mYW1pbHk6J0FyaWFsIE5hcnJvdyc7LWlua3NjYXBlLWZvbnQtc3BlY2lmaWNhdGlvbjonQXJpYWwgTmFycm93LCBCb2xkIENvbmRlbnNlZCc7Zm9udC12YXJpYW50LWxpZ2F0dXJlczpub3JtYWw7Zm9udC12YXJpYW50LWNhcHM6bm9ybWFsO2ZvbnQtdmFyaWFudC1udW1lcmljOm5vcm1hbDtmb250LWZlYXR1cmUtc2V0dGluZ3M6bm9ybWFsO3RleHQtYWxpZ246c3RhcnQ7d3JpdGluZy1tb2RlOmxyLXRiO3RleHQtYW5jaG9yOnN0YXJ0O3N0cm9rZS13aWR0aDowLjI2NDU4MzMyIj4xMjM8L3RzcGFuPjwvdGV4dD4KICA8L2c+Cjwvc3ZnPgo=";
    static stringArgIcon = "data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiIHN0YW5kYWxvbmU9Im5vIj8+CjxzdmcKICAgeG1sbnM6ZGM9Imh0dHA6Ly9wdXJsLm9yZy9kYy9lbGVtZW50cy8xLjEvIgogICB4bWxuczpjYz0iaHR0cDovL2NyZWF0aXZlY29tbW9ucy5vcmcvbnMjIgogICB4bWxuczpyZGY9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkvMDIvMjItcmRmLXN5bnRheC1ucyMiCiAgIHhtbG5zOnN2Zz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciCiAgIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIKICAgaWQ9InN2ZzgiCiAgIHZlcnNpb249IjEuMSIKICAgdmlld0JveD0iMCAwIDE4LjM1MDMwMiA3LjgzNDE0NyIKICAgaGVpZ2h0PSI3LjgzNDE0N21tIgogICB3aWR0aD0iMTguMzUwMzAybW0iPgogIDxkZWZzCiAgICAgaWQ9ImRlZnMyIiAvPgogIDxtZXRhZGF0YQogICAgIGlkPSJtZXRhZGF0YTUiPgogICAgPHJkZjpSREY+CiAgICAgIDxjYzpXb3JrCiAgICAgICAgIHJkZjphYm91dD0iIj4KICAgICAgICA8ZGM6Zm9ybWF0PmltYWdlL3N2Zyt4bWw8L2RjOmZvcm1hdD4KICAgICAgICA8ZGM6dHlwZQogICAgICAgICAgIHJkZjpyZXNvdXJjZT0iaHR0cDovL3B1cmwub3JnL2RjL2RjbWl0eXBlL1N0aWxsSW1hZ2UiIC8+CiAgICAgICAgPGRjOnRpdGxlPjwvZGM6dGl0bGU+CiAgICAgIDwvY2M6V29yaz4KICAgIDwvcmRmOlJERj4KICA8L21ldGFkYXRhPgogIDxnCiAgICAgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoLTk3LjU5MjE4NiwtMTQ0LjUzMzgzKSIKICAgICBpZD0ibGF5ZXIxIj4KICAgIDx0ZXh0CiAgICAgICBpZD0idGV4dDM3MTUiCiAgICAgICB5PSIxNTIuMjM4NzgiCiAgICAgICB4PSI5Ny41OTIxODYiCiAgICAgICBzdHlsZT0iZm9udC1zdHlsZTpub3JtYWw7Zm9udC12YXJpYW50Om5vcm1hbDtmb250LXdlaWdodDpib2xkO2ZvbnQtc3RyZXRjaDpjb25kZW5zZWQ7Zm9udC1zaXplOjEwLjU4MzMzMzAycHg7bGluZS1oZWlnaHQ6MS4yNTtmb250LWZhbWlseTonQXJpYWwgTmFycm93JzstaW5rc2NhcGUtZm9udC1zcGVjaWZpY2F0aW9uOidBcmlhbCBOYXJyb3csIEJvbGQgQ29uZGVuc2VkJztmb250LXZhcmlhbnQtbGlnYXR1cmVzOm5vcm1hbDtmb250LXZhcmlhbnQtY2Fwczpub3JtYWw7Zm9udC12YXJpYW50LW51bWVyaWM6bm9ybWFsO2ZvbnQtZmVhdHVyZS1zZXR0aW5nczpub3JtYWw7dGV4dC1hbGlnbjpzdGFydDtsZXR0ZXItc3BhY2luZzowcHg7d29yZC1zcGFjaW5nOjBweDt3cml0aW5nLW1vZGU6bHItdGI7dGV4dC1hbmNob3I6c3RhcnQ7ZmlsbDojMDAwMDAwO2ZpbGwtb3BhY2l0eToxO3N0cm9rZTpub25lO3N0cm9rZS13aWR0aDowLjI2NDU4MzMyIgogICAgICAgeG1sOnNwYWNlPSJwcmVzZXJ2ZSI+PHRzcGFuCiAgICAgICAgIHk9IjE1Mi4yMzg3OCIKICAgICAgICAgeD0iOTcuNTkyMTg2IgogICAgICAgICBpZD0idHNwYW4zNzI1Ij5BQkM8L3RzcGFuPjwvdGV4dD4KICA8L2c+Cjwvc3ZnPgo=";
    static stringArgCardImage = "data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiIHN0YW5kYWxvbmU9Im5vIj8+CjxzdmcKICAgeG1sbnM6ZGM9Imh0dHA6Ly9wdXJsLm9yZy9kYy9lbGVtZW50cy8xLjEvIgogICB4bWxuczpjYz0iaHR0cDovL2NyZWF0aXZlY29tbW9ucy5vcmcvbnMjIgogICB4bWxuczpyZGY9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkvMDIvMjItcmRmLXN5bnRheC1ucyMiCiAgIHhtbG5zOnN2Zz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciCiAgIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIKICAgd2lkdGg9IjNjbSIKICAgaGVpZ2h0PSIyY20iCiAgIHZpZXdCb3g9IjAgMCAyOS45OTk5OTkgMjAiCiAgIHZlcnNpb249IjEuMSIKICAgaWQ9InN2ZzgiPgogIDxkZWZzCiAgICAgaWQ9ImRlZnMyIiAvPgogIDxtZXRhZGF0YQogICAgIGlkPSJtZXRhZGF0YTUiPgogICAgPHJkZjpSREY+CiAgICAgIDxjYzpXb3JrCiAgICAgICAgIHJkZjphYm91dD0iIj4KICAgICAgICA8ZGM6Zm9ybWF0PmltYWdlL3N2Zyt4bWw8L2RjOmZvcm1hdD4KICAgICAgICA8ZGM6dHlwZQogICAgICAgICAgIHJkZjpyZXNvdXJjZT0iaHR0cDovL3B1cmwub3JnL2RjL2RjbWl0eXBlL1N0aWxsSW1hZ2UiIC8+CiAgICAgICAgPGRjOnRpdGxlPjwvZGM6dGl0bGU+CiAgICAgIDwvY2M6V29yaz4KICAgIDwvcmRmOlJERj4KICA8L21ldGFkYXRhPgogIDxnCiAgICAgaWQ9ImxheWVyMSIKICAgICB0cmFuc2Zvcm09InRyYW5zbGF0ZSgtOTEuNzY3MzM3LC0xMzguNDUwOSkiPgogICAgPHRleHQKICAgICAgIHhtbDpzcGFjZT0icHJlc2VydmUiCiAgICAgICBzdHlsZT0iZm9udC1zdHlsZTpub3JtYWw7Zm9udC12YXJpYW50Om5vcm1hbDtmb250LXdlaWdodDpib2xkO2ZvbnQtc3RyZXRjaDpjb25kZW5zZWQ7Zm9udC1zaXplOjEwLjU4MzMzMzAycHg7bGluZS1oZWlnaHQ6MS4yNTtmb250LWZhbWlseTonQXJpYWwgTmFycm93JzstaW5rc2NhcGUtZm9udC1zcGVjaWZpY2F0aW9uOidBcmlhbCBOYXJyb3csIEJvbGQgQ29uZGVuc2VkJztmb250LXZhcmlhbnQtbGlnYXR1cmVzOm5vcm1hbDtmb250LXZhcmlhbnQtY2Fwczpub3JtYWw7Zm9udC12YXJpYW50LW51bWVyaWM6bm9ybWFsO2ZvbnQtZmVhdHVyZS1zZXR0aW5nczpub3JtYWw7dGV4dC1hbGlnbjpzdGFydDtsZXR0ZXItc3BhY2luZzowcHg7d29yZC1zcGFjaW5nOjBweDt3cml0aW5nLW1vZGU6bHItdGI7dGV4dC1hbmNob3I6c3RhcnQ7ZmlsbDojMDAwMDAwO2ZpbGwtb3BhY2l0eToxO3N0cm9rZTpub25lO3N0cm9rZS13aWR0aDowLjI2NDU4MzMyIgogICAgICAgeD0iOTcuNTkyMTg2IgogICAgICAgeT0iMTUyLjIzODc4IgogICAgICAgaWQ9InRleHQzNzE1Ij48dHNwYW4KICAgICAgICAgaWQ9InRzcGFuMzcyNSIKICAgICAgICAgeD0iOTcuNTkyMTg2IgogICAgICAgICB5PSIxNTIuMjM4NzgiPkFCQzwvdHNwYW4+PC90ZXh0PgogIDwvZz4KPC9zdmc+Cg==";
    static customArgDefaultIcon = "data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiPz4KPHN2ZyB2ZXJzaW9uPSIxLjEiIHZpZXdCb3g9IjAgMCAxMDAwIDEwMDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgeG1sbnM6Y2M9Imh0dHA6Ly9jcmVhdGl2ZWNvbW1vbnMub3JnL25zIyIgeG1sbnM6ZGM9Imh0dHA6Ly9wdXJsLm9yZy9kYy9lbGVtZW50cy8xLjEvIiB4bWxuczpyZGY9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkvMDIvMjItcmRmLXN5bnRheC1ucyMiPgo8bWV0YWRhdGE+CjxyZGY6UkRGPgo8Y2M6V29yayByZGY6YWJvdXQ9IiI+CjxkYzpmb3JtYXQ+aW1hZ2Uvc3ZnK3htbDwvZGM6Zm9ybWF0Pgo8ZGM6dHlwZSByZGY6cmVzb3VyY2U9Imh0dHA6Ly9wdXJsLm9yZy9kYy9kY21pdHlwZS9TdGlsbEltYWdlIi8+CjwvY2M6V29yaz4KPC9yZGY6UkRGPgo8L21ldGFkYXRhPgo8ZyB0cmFuc2Zvcm09Im1hdHJpeCgxLjA3MDMgMCAwIDEuMDUyNCAtMTUuMzcxIC0yNy43NikiPgo8cGF0aCBkPSJtNDkyLjAxIDU4LjcyNmMtNjUuODgtMC4zNzQyNy0xMzAuOTYgMzQuMTI5LTE2Ni44MSA4OS41NjctMzMuNjYxIDQ4LjY0NS00OC4zNjUgMTA3Ljc0LTUzLjkxMiAxNjUuOS0xMS4yNjgtMS42OTg4LTIzLjcwOCAyLjQ3MTEtMzAuMTY0IDEyLjE5NS0xNy4zMjkgMTcuMDQtMzQuNjU4IDM0LjA4MS01MS45ODggNTEuMTIxaDc1LjUzM2MtMTIuODE3IDExNi4zLTIxLjg5NyAyMzMuMDUtMzguMTQ1IDM0OC45LTYuNDA0OSAzMC41MjctMTkuMjI4IDYzLjUzNi00Ny40MTIgODAuMTg5LTI3LjEzNCAxNC44ODUtNTkuODg2IDExLjA1MS04Ny45MjggMC44NzEwOS04LjQwMTYtMS45NjYtMTIuOTU4IDcuODQ2Ni0xOS4wMjkgMTEuNjQ4LTE2LjY4NCAxNC43ODktMzMuMzY3IDI5LjU3OS01MC4wNTEgNDQuMzY3IDM3LjcyOSAxOS44NzcgODMuNjcgMjIuMDAyIDEyMy42IDcuOTEyOCA3Mi4xMjctMjMuMDMxIDEzMC4zMy04NC40OSAxNDkuNzctMTU3LjY0IDE1LjIyOC01My43ODMgMTcuODI3LTEwOS45OCAyNC4yMzgtMTY1LjIzIDUuODM4MS01Ny4wMTcgMTEuODg3LTExNC4wMSAxNy43OTItMTcxLjAyaDg2LjU4MmMyMi4zNzUtMjEuMDggNDQuNzUxLTQyLjE2MSA2Ny4xMjctNjMuMjRoLTE0Ni45MmM2LjE5NS01NC41MjYgOC43NTQ4LTExMS4zNCAzMy42MjktMTYxLjE3IDEzLjQ5OC0yMS43MSA0MC4wMzItMzEuMDg1IDY0LjMzNi0zMC4yMjkgMTcuNDg4LTRlLTMgMzQuODMzIDQuMTYxMiA1MC44MDUgMTEuMTcyIDIzLjcxMy0yMi41OTIgNDcuNDI1LTQ1LjE4NSA3MS4xMzktNjcuNzc3LTIzLjg4OS0zLjc5OC00Ny45MTktNy44NTQ5LTcyLjE4OS03LjU0NDl6Ii8+CjxwYXRoIGQ9Im01NTQuODkgMzgxLjA1Yy0xNy41ODQgNS4wOTUtMjkuODQ3IDE5Ljg1Ny00NC41MiAyOS45MjgtNjUuMDk2IDUzLjYwMS0xMTQuMDYgMTI5LjA4LTEyNy45NSAyMTIuOTgtMjAuMzczIDEwOS4xOSA4LjMwMzUgMjI2LjQ2IDc3LjA0OSAzMTMuNzYgNi4zMDMzIDguMjc0NiAxMi45MjUgMTYuMzAxIDE5LjY5MSAyNC4xOTkgMTYuOTA4LTE3LjE3MyAzMy44MTQtMzQuMzQ5IDUwLjcyMy01MS41MjEtNjcuODA1LTc2Ljc0NS05OS4yMzctMTgzLjc4LTg0Ljg1Mi0yODQuOCA4LjkzNTMtNjYuNzg5IDM5LjY1LTEzMS4xNCA4OC4wNzQtMTc4LjE2IDE4Ljc0My0xOS4xOTcgNDAuMDcyLTM1LjMzIDYxLjM5Ni01MS40OTItNy4yODcxLTAuMTUwNzQtMTYuMDkgNC44NTQxLTIyLjUyMy0wLjM3NS0zLjIxODgtNi44ODgtOC40NzctMTQuNzY2LTE3LjA5Mi0xNC41MDh6Ii8+CjxwYXRoIGQ9Im01OTguNDMgNTQzLjU5Yy0yMi4xOTcgMS41NjU0LTM4Ljc0OSAxOS4xNC01MC44ODUgMzYuMjAxLTkuMTU1NSAxMi4yMjMtMTYuMDUxIDMwLjAxMS03LjU1MjcgNDQuMzIyIDYuMDY2NyA4LjA2MjcgMTYuNjIzIDkuODgyOCAyNS40NjcgMTMuMzQyIDYuMzQxNS0xMS42MjMgNS45OTgtMjcuNDc5IDE3LjcxMS0zNS42NSA3LjY4NjggNC40NjU3IDguODIzOCAxNC4zMDIgMTMuNDc3IDIxLjI2OSA5LjIxNzQgMTkuNDUxIDE2Ljk5NyAzOS41MjggMjQuNTY0IDU5LjY0MS0xNi4yMjggMjUuNTU2LTMwLjI3MiA1NS4yMDEtNTcuNTQzIDcwLjY5Ny03LjYwMTIgMy40OTk4LTE0LjU2Ny0yLjU2NzUtMjAuODcxLTUuNjQ4NC0xMS40NDYtMi4wMjk3LTE4LjI1NCA5LjcyOC0yNS41MDQgMTYuMjUtOC43ODMzIDguNDExNC0xNy4yNjIgMTcuMTM1LTI2LjExNyAyNS40NzQgMjIuNTM0IDI3LjM4NSA2Ny4xNDkgMjguNjA3IDkzLjcwMSA2LjQ4MDUgMjMuMTg4LTE2Ljg0MSA0MC43OC00MC4wNzcgNTUuNTkyLTY0LjMzMiAxMC42NDIgMjcuNjc2IDIzLjQyNSA1Ny4wNTEgNDguMzgxIDc0Ljc1IDE2LjM5NiA5LjM2NTYgMzcuNTg1IDQuNTcxMiA1MS40MzctNy4yNDkgMTUuNjY5LTEwLjg2OSAzMS4wNTItMjUuNjkgMzQuNjk2LTQ1LjE1MyAwLjc1NjkzLTEzLjYxMi0xMS4yNC0yOC40ODItMjUuNTQxLTI2Ljc2OC05LjIxNjQgMi42ODg4LTguNDIxMyAxNC4xNDctMTMuMjczIDIwLjY0NS0yLjczMjcgNC45ODQ3LTkuODg5MSAxMC4yMzQtMTQuMzQ0IDMuOTUxMi03LjM3MzMtNy43MzQ4LTExLjA4MS0xOC4wODctMTYuNTA5LTI3LjE0NC05LjA2NzQtMTguNTA3LTE2LjA0My0zOC4wNTQtMjMuMjU1LTU3LjM5NSAxNC4yMjEtMjIuMzcyIDI3LjM4My00OC40OTIgNTIuMjg3LTYwLjUzMSA1LjE1NzktMS4yNDc0IDEwLjU2OSAxLjA2NzMgMTQuMDc2IDQuODYxMyAxNi41ODctMTcuNDEyIDMzLjE3Ni0zNC44MjMgNDkuNzY2LTUyLjIzMi0xOC42ODMtMTMuMTk2LTQ0LjQxNS0yMS4xMDUtNjYuMjI1LTEwLjg5NS0yOS43MjMgMTUuMjY5LTUwLjE5OCA0Mi45NzQtNjguMzUgNzAuMTMzLTEwLjYwNS0yNi4yNjYtMjIuOTQ4LTU0LjUzNi00Ny42MTktNzAuNTIxLTUuMzczNC0yLjg4MTYtMTEuNDM3LTQuNjQwOS0xNy41NjYtNC40OTh6Ii8+CjxwYXRoIGQ9Im04MjYuMDggMzc1LjY5Yy0xNi40MTcgMTYuNTUxLTMyLjgzNyAzMy4xMDEtNDkuMjU2IDQ5LjY1IDc0Ljk1NCA4NS4wODUgMTA1LjM2IDIwNy4xNCA3OC44NjQgMzE3LjA2LTEzLjQ1OCA1Ni41NTQtNDMuMDA1IDEwOS4yMy04NS4yNDUgMTQ5LjM3LTE3LjM3NSAxNy41MjgtMzcuMzY5IDMyLjA4OS01Ni41ODIgNDcuNDM5IDcuMDI4OC0wLjQ2NDcxIDE3LjczLTQuODU4MSAyMi4xMzkgMy4yNTU5IDIuODYxNCA4Ljk3MzMgMTQuMjk3IDE2LjA1NCAyMi44ODMgOS45MDYyIDE1LjA5OS04LjI3NjMgMjcuODktMjAuMDg4IDQxLjM5MS0zMC42MzUgNjAuNzY3LTUxLjYwNiAxMDcuMTYtMTIyLjIxIDEyMi4zMS0yMDEuMTMgMjIuODUzLTEwOC41MS0zLjEyMTEtMjI2LjIxLTY5LjgwOC0zMTQuODUtNy45NDAzLTEwLjg4NC0xNi4zODktMjEuMzkxLTI1LjE2OS0zMS42MDgtMC41MTA0MiAwLjUxNTYzLTEuMDIwOCAxLjAzMTItMS41MzEzIDEuNTQ2OXoiLz4KPC9nPgo8L3N2Zz4K";
    static customArgDefaultCardImage = "data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiIHN0YW5kYWxvbmU9Im5vIj8+CjxzdmcKICAgeG1sbnM6ZGM9Imh0dHA6Ly9wdXJsLm9yZy9kYy9lbGVtZW50cy8xLjEvIgogICB4bWxuczpjYz0iaHR0cDovL2NyZWF0aXZlY29tbW9ucy5vcmcvbnMjIgogICB4bWxuczpyZGY9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkvMDIvMjItcmRmLXN5bnRheC1ucyMiCiAgIHhtbG5zOnN2Zz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciCiAgIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIKICAgaGVpZ2h0PSIyY20iCiAgIHdpZHRoPSIzY20iCiAgIGlkPSJzdmczNzkxIgogICB2aWV3Qm94PSIwIDAgMTEzLjM4NTgyIDc1LjU5MDU0OSIKICAgdmVyc2lvbj0iMS4xIj4KICA8ZGVmcwogICAgIGlkPSJkZWZzMzc5NSIgLz4KICA8bWV0YWRhdGEKICAgICBpZD0ibWV0YWRhdGEzNzc5Ij4KICAgIDxyZGY6UkRGPgogICAgICA8Y2M6V29yawogICAgICAgICByZGY6YWJvdXQ9IiI+CiAgICAgICAgPGRjOmZvcm1hdD5pbWFnZS9zdmcreG1sPC9kYzpmb3JtYXQ+CiAgICAgICAgPGRjOnR5cGUKICAgICAgICAgICByZGY6cmVzb3VyY2U9Imh0dHA6Ly9wdXJsLm9yZy9kYy9kY21pdHlwZS9TdGlsbEltYWdlIiAvPgogICAgICAgIDxkYzp0aXRsZT48L2RjOnRpdGxlPgogICAgICA8L2NjOldvcms+CiAgICA8L3JkZjpSREY+CiAgPC9tZXRhZGF0YT4KICA8ZwogICAgIGlkPSJnMzc4OSIKICAgICB0cmFuc2Zvcm09Im1hdHJpeCgwLjAzMTIwOTk1LDAsMCwwLjAzMDY4Nzk4LDQxLjgyNDIyNSwyMi4xMzQ5MTgpIj4KICAgIDxwYXRoCiAgICAgICBpZD0icGF0aDM3ODEiCiAgICAgICBkPSJtIDQ5Mi4wMSw1OC43MjYgYyAtNjUuODgsLTAuMzc0MjcgLTEzMC45NiwzNC4xMjkgLTE2Ni44MSw4OS41NjcgLTMzLjY2MSw0OC42NDUgLTQ4LjM2NSwxMDcuNzQgLTUzLjkxMiwxNjUuOSAtMTEuMjY4LC0xLjY5ODggLTIzLjcwOCwyLjQ3MTEgLTMwLjE2NCwxMi4xOTUgLTE3LjMyOSwxNy4wNCAtMzQuNjU4LDM0LjA4MSAtNTEuOTg4LDUxLjEyMSBoIDc1LjUzMyBjIC0xMi44MTcsMTE2LjMgLTIxLjg5NywyMzMuMDUgLTM4LjE0NSwzNDguOSAtNi40MDQ5LDMwLjUyNyAtMTkuMjI4LDYzLjUzNiAtNDcuNDEyLDgwLjE4OSAtMjcuMTM0LDE0Ljg4NSAtNTkuODg2LDExLjA1MSAtODcuOTI4LDAuODcxMDkgLTguNDAxNiwtMS45NjYgLTEyLjk1OCw3Ljg0NjYgLTE5LjAyOSwxMS42NDggLTE2LjY4NCwxNC43ODkgLTMzLjM2NywyOS41NzkgLTUwLjA1MSw0NC4zNjcgMzcuNzI5LDE5Ljg3NyA4My42NywyMi4wMDIgMTIzLjYsNy45MTI4IDcyLjEyNywtMjMuMDMxIDEzMC4zMywtODQuNDkgMTQ5Ljc3LC0xNTcuNjQgMTUuMjI4LC01My43ODMgMTcuODI3LC0xMDkuOTggMjQuMjM4LC0xNjUuMjMgNS44MzgxLC01Ny4wMTcgMTEuODg3LC0xMTQuMDEgMTcuNzkyLC0xNzEuMDIgaCA4Ni41ODIgYyAyMi4zNzUsLTIxLjA4IDQ0Ljc1MSwtNDIuMTYxIDY3LjEyNywtNjMuMjQgaCAtMTQ2LjkyIGMgNi4xOTUsLTU0LjUyNiA4Ljc1NDgsLTExMS4zNCAzMy42MjksLTE2MS4xNyAxMy40OTgsLTIxLjcxIDQwLjAzMiwtMzEuMDg1IDY0LjMzNiwtMzAuMjI5IDE3LjQ4OCwtMC4wMDQgMzQuODMzLDQuMTYxMiA1MC44MDUsMTEuMTcyIDIzLjcxMywtMjIuNTkyIDQ3LjQyNSwtNDUuMTg1IDcxLjEzOSwtNjcuNzc3IC0yMy44ODksLTMuNzk4IC00Ny45MTksLTcuODU0OSAtNzIuMTg5LC03LjU0NDkgeiIgLz4KICAgIDxwYXRoCiAgICAgICBpZD0icGF0aDM3ODMiCiAgICAgICBkPSJtIDU1NC44OSwzODEuMDUgYyAtMTcuNTg0LDUuMDk1IC0yOS44NDcsMTkuODU3IC00NC41MiwyOS45MjggLTY1LjA5Niw1My42MDEgLTExNC4wNiwxMjkuMDggLTEyNy45NSwyMTIuOTggLTIwLjM3MywxMDkuMTkgOC4zMDM1LDIyNi40NiA3Ny4wNDksMzEzLjc2IDYuMzAzMyw4LjI3NDYgMTIuOTI1LDE2LjMwMSAxOS42OTEsMjQuMTk5IDE2LjkwOCwtMTcuMTczIDMzLjgxNCwtMzQuMzQ5IDUwLjcyMywtNTEuNTIxIC02Ny44MDUsLTc2Ljc0NSAtOTkuMjM3LC0xODMuNzggLTg0Ljg1MiwtMjg0LjggOC45MzUzLC02Ni43ODkgMzkuNjUsLTEzMS4xNCA4OC4wNzQsLTE3OC4xNiAxOC43NDMsLTE5LjE5NyA0MC4wNzIsLTM1LjMzIDYxLjM5NiwtNTEuNDkyIC03LjI4NzEsLTAuMTUwNzQgLTE2LjA5LDQuODU0MSAtMjIuNTIzLC0wLjM3NSAtMy4yMTg4LC02Ljg4OCAtOC40NzcsLTE0Ljc2NiAtMTcuMDkyLC0xNC41MDggeiIgLz4KICAgIDxwYXRoCiAgICAgICBpZD0icGF0aDM3ODUiCiAgICAgICBkPSJtIDU5OC40Myw1NDMuNTkgYyAtMjIuMTk3LDEuNTY1NCAtMzguNzQ5LDE5LjE0IC01MC44ODUsMzYuMjAxIC05LjE1NTUsMTIuMjIzIC0xNi4wNTEsMzAuMDExIC03LjU1MjcsNDQuMzIyIDYuMDY2Nyw4LjA2MjcgMTYuNjIzLDkuODgyOCAyNS40NjcsMTMuMzQyIDYuMzQxNSwtMTEuNjIzIDUuOTk4LC0yNy40NzkgMTcuNzExLC0zNS42NSA3LjY4NjgsNC40NjU3IDguODIzOCwxNC4zMDIgMTMuNDc3LDIxLjI2OSA5LjIxNzQsMTkuNDUxIDE2Ljk5NywzOS41MjggMjQuNTY0LDU5LjY0MSAtMTYuMjI4LDI1LjU1NiAtMzAuMjcyLDU1LjIwMSAtNTcuNTQzLDcwLjY5NyAtNy42MDEyLDMuNDk5OCAtMTQuNTY3LC0yLjU2NzUgLTIwLjg3MSwtNS42NDg0IC0xMS40NDYsLTIuMDI5NyAtMTguMjU0LDkuNzI4IC0yNS41MDQsMTYuMjUgLTguNzgzMyw4LjQxMTQgLTE3LjI2MiwxNy4xMzUgLTI2LjExNywyNS40NzQgMjIuNTM0LDI3LjM4NSA2Ny4xNDksMjguNjA3IDkzLjcwMSw2LjQ4MDUgMjMuMTg4LC0xNi44NDEgNDAuNzgsLTQwLjA3NyA1NS41OTIsLTY0LjMzMiAxMC42NDIsMjcuNjc2IDIzLjQyNSw1Ny4wNTEgNDguMzgxLDc0Ljc1IDE2LjM5Niw5LjM2NTYgMzcuNTg1LDQuNTcxMiA1MS40MzcsLTcuMjQ5IDE1LjY2OSwtMTAuODY5IDMxLjA1MiwtMjUuNjkgMzQuNjk2LC00NS4xNTMgMC43NTY5MywtMTMuNjEyIC0xMS4yNCwtMjguNDgyIC0yNS41NDEsLTI2Ljc2OCAtOS4yMTY0LDIuNjg4OCAtOC40MjEzLDE0LjE0NyAtMTMuMjczLDIwLjY0NSAtMi43MzI3LDQuOTg0NyAtOS44ODkxLDEwLjIzNCAtMTQuMzQ0LDMuOTUxMiAtNy4zNzMzLC03LjczNDggLTExLjA4MSwtMTguMDg3IC0xNi41MDksLTI3LjE0NCAtOS4wNjc0LC0xOC41MDcgLTE2LjA0MywtMzguMDU0IC0yMy4yNTUsLTU3LjM5NSAxNC4yMjEsLTIyLjM3MiAyNy4zODMsLTQ4LjQ5MiA1Mi4yODcsLTYwLjUzMSA1LjE1NzksLTEuMjQ3NCAxMC41NjksMS4wNjczIDE0LjA3Niw0Ljg2MTMgMTYuNTg3LC0xNy40MTIgMzMuMTc2LC0zNC44MjMgNDkuNzY2LC01Mi4yMzIgLTE4LjY4MywtMTMuMTk2IC00NC40MTUsLTIxLjEwNSAtNjYuMjI1LC0xMC44OTUgLTI5LjcyMywxNS4yNjkgLTUwLjE5OCw0Mi45NzQgLTY4LjM1LDcwLjEzMyAtMTAuNjA1LC0yNi4yNjYgLTIyLjk0OCwtNTQuNTM2IC00Ny42MTksLTcwLjUyMSAtNS4zNzM0LC0yLjg4MTYgLTExLjQzNywtNC42NDA5IC0xNy41NjYsLTQuNDk4IHoiIC8+CiAgICA8cGF0aAogICAgICAgaWQ9InBhdGgzNzg3IgogICAgICAgZD0ibSA4MjYuMDgsMzc1LjY5IGMgLTE2LjQxNywxNi41NTEgLTMyLjgzNywzMy4xMDEgLTQ5LjI1Niw0OS42NSA3NC45NTQsODUuMDg1IDEwNS4zNiwyMDcuMTQgNzguODY0LDMxNy4wNiAtMTMuNDU4LDU2LjU1NCAtNDMuMDA1LDEwOS4yMyAtODUuMjQ1LDE0OS4zNyAtMTcuMzc1LDE3LjUyOCAtMzcuMzY5LDMyLjA4OSAtNTYuNTgyLDQ3LjQzOSA3LjAyODgsLTAuNDY0NzEgMTcuNzMsLTQuODU4MSAyMi4xMzksMy4yNTU5IDIuODYxNCw4Ljk3MzMgMTQuMjk3LDE2LjA1NCAyMi44ODMsOS45MDYyIDE1LjA5OSwtOC4yNzYzIDI3Ljg5LC0yMC4wODggNDEuMzkxLC0zMC42MzUgNjAuNzY3LC01MS42MDYgMTA3LjE2LC0xMjIuMjEgMTIyLjMxLC0yMDEuMTMgMjIuODUzLC0xMDguNTEgLTMuMTIxMSwtMjI2LjIxIC02OS44MDgsLTMxNC44NSAtNy45NDAzLC0xMC44ODQgLTE2LjM4OSwtMjEuMzkxIC0yNS4xNjksLTMxLjYwOCAtMC41MTA0MiwwLjUxNTYzIC0xLjAyMDgsMS4wMzEyIC0xLjUzMTMsMS41NDY5IHoiIC8+CiAgPC9nPgo8L3N2Zz4K";

    constructor(props: ISettingsProps) {
        super(props);
        this.state = {
            visible: false,
            functionEditorWorkspace: null,
            functionCallback: null,
            initialMutation: null,
            functionBeingEdited: null
        };

        this.hide = this.hide.bind(this);
        this.modalDidOpen = this.modalDidOpen.bind(this);
        this.cancel = this.cancel.bind(this);
        this.confirm = this.confirm.bind(this);
    }

    hide() {
        Blockly.WidgetDiv.DIV.classList.remove("functioneditor");
        const { functionEditorWorkspace, mainWorkspace } = this.state;
        functionEditorWorkspace.clear();
        functionEditorWorkspace.dispose();
        (mainWorkspace as any).refreshToolboxSelection();
        this.setState({
            visible: false, functionEditorWorkspace: null,
            functionCallback: null,
            initialMutation: null,
            functionBeingEdited: null
        });
    }

    show(initialMutation: Element, cb: Blockly.Functions.ConfirmEditCallback, mainWorkspace: Blockly.Workspace) {
        pxt.tickEvent('createfunction.show', null, { interactiveConsent: false });
        this.setState({
            visible: true,
            functionCallback: cb,
            initialMutation,
            mainWorkspace
        });
    }

    modalDidOpen(ref: HTMLElement) {
        const workspaceDiv = document.getElementById('functionEditorWorkspace');
        let { functionEditorWorkspace, initialMutation } = this.state;

        if (!workspaceDiv) {
            return;
        }

        // Adjust the WidgetDiv classname so that it can show up above the dimmer
        Blockly.WidgetDiv.DIV.classList.add("functioneditor");

        // Create the function editor workspace
        functionEditorWorkspace = Blockly.inject(workspaceDiv, {
            trashcan: false,
            scrollbars: true
        });
        (functionEditorWorkspace as any).showContextMenu_ = () => { }; // Disable the context menu
        functionEditorWorkspace.clear();

        const functionBeingEdited = functionEditorWorkspace.newBlock('function_declaration') as Blockly.FunctionDeclarationBlock;
        (functionBeingEdited as any).domToMutation(initialMutation);
        functionBeingEdited.initSvg();
        functionBeingEdited.render(false);
        functionEditorWorkspace.centerOnBlock(functionBeingEdited.id);

        functionEditorWorkspace.addChangeListener(() => {
            const { functionBeingEdited } = this.state;
            if (functionBeingEdited) {
                functionBeingEdited.updateFunctionSignature();
            }
        });

        this.setState({
            functionEditorWorkspace,
            functionBeingEdited
        });
        Blockly.svgResize(functionEditorWorkspace);
    }

    cancel() {
        pxt.tickEvent("createfunction.cancel", undefined, { interactiveConsent: true });
        this.hide();
    }

    confirm() {
        const { functionBeingEdited, mainWorkspace, functionCallback } = this.state;
        const mutation = (functionBeingEdited as any).mutationToDom();
        if (Blockly.Functions.validateFunctionExternal(mutation, mainWorkspace)) {
            functionCallback(mutation);
            this.hide();
        }
    }

    addArgumentFactory(typeName: string) {
        // const self = this;
        // return () => self.addArgument(typeName);
        return () => this.addArgument(typeName);
    }

    addArgument(typeName: string) {
        const { functionBeingEdited } = this.state;
        switch (typeName) {
            case "boolean":
                functionBeingEdited.addBooleanExternal();
                break;
            case "string":
                functionBeingEdited.addStringExternal();
                break;
            case "number":
                functionBeingEdited.addNumberExternal();
                break;
            default:
                functionBeingEdited.addCustomExternal(typeName);
                break;
        }
    }

    renderCore() {
        const { visible } = this.state;
        const actions: sui.ModalButton[] = [{
            label: lf("Done"),
            onclick: this.confirm,
            icon: 'check',
            className: 'approve positive'
        }];
        const types = this.getArgumentTypes().slice();

        return (
            <sui.Modal isOpen={visible} className="createfunction" size="large"
                onClose={this.hide} dimmer={true} buttons={actions}
                closeIcon={true} header={lf("Edit Function")}
                closeOnDimmerClick closeOnDocumentClick closeOnEscape
                modalDidOpen={this.modalDidOpen}
            >
                <div>
                    <div id="functionEditorWorkspace"></div>
                    <div className="group">
                        <div className="ui cards centered" role="listbox">
                            {types.map(t =>
                                <codecard.CodeCardView
                                    key={t.typeName}
                                    name={lf("Add {0}", t.label || t.typeName)}
                                    ariaLabel={lf("Add {0}", t.label || t.typeName)}
                                    onClick={this.addArgumentFactory(t.typeName)}
                                    imageUrl={t.cardImage}
                                />
                            )}
                        </div>
                    </div>
                </div>
            </sui.Modal>
        )
    }

    private getArgumentTypes(): pxt.FunctionEditorTypeInfo[] {
        if (!CreateFunctionDialog.cachedFunctionTypes) {
            const types: pxt.FunctionEditorTypeInfo[] = [
                {
                    label: lf("Text"),
                    typeName: "string",
                    icon: CreateFunctionDialog.stringArgIcon,
                    cardImage: CreateFunctionDialog.stringArgCardImage
                },
                {
                    label: lf("Boolean"),
                    typeName: "boolean",
                    icon: CreateFunctionDialog.booleanArgIcon,
                    cardImage: CreateFunctionDialog.booleanArgCardImage
                },
                {
                    label: lf("Number"),
                    typeName: "number",
                    icon: CreateFunctionDialog.numberArgIcon,
                    cardImage: CreateFunctionDialog.numberArgCardImage
                }
            ];

            if (pxt.appTarget.runtime &&
                pxt.appTarget.runtime.functionsOptions &&
                pxt.appTarget.runtime.functionsOptions.extraFunctionEditorTypes &&
                Array.isArray(pxt.appTarget.runtime.functionsOptions.extraFunctionEditorTypes)) {
                pxt.appTarget.runtime.functionsOptions.extraFunctionEditorTypes.forEach(t => {
                    types.push(t);
                });
            }

            const icons: pxt.Map<string> = {};
            types.forEach(t => {
                if (!t.icon) {
                    t.icon = CreateFunctionDialog.customArgDefaultIcon;
                    t.cardImage = CreateFunctionDialog.customArgDefaultCardImage;
                }
                icons[t.typeName] = t.icon;
            });
            Blockly.PXTBlockly.FunctionUtils.argumentIcons = icons;
            CreateFunctionDialog.cachedFunctionTypes = types;
        }

        return CreateFunctionDialog.cachedFunctionTypes;
    }
}