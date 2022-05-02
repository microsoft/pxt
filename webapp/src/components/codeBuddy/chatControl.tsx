import * as React from "react";
import * as data from "../../data";

import { Activity, ActivityTypes } from 'botframework-schema';
import { createStyleSet, Components as WebChatComponents } from 'botframework-webchat';

const { BasicWebChat, Composer } = WebChatComponents;

export class ChatControl extends data.PureComponent<{}, {}> {
    renderCore() {
        return (
            <BasicWebChat />
        )
    }
}