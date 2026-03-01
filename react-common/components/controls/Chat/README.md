# Chat

React Common Chat component

This directory contains a basic chat UI component used as a lightweight, extensible chat/transcript UI.

Main exports:

- `Chat` — top-level composite rendering a message list and composer
- `ChatMessageList` — list-only rendering with tail-biased windowing and bottom-anchoring
- `ChatComposer` — a small composer input using `textarea` and `Button` for sending
- `ChatTypes` — typed serializable message parts and envelopes

Usage example:

```
import { Chat } from 'react-common/components/controls/Chat/Chat';
import { Message } from 'react-common/components/controls/Chat/chat.types';

const [messages, setMessages] = React.useState<Message[]>([]);

<Chat
  messages={messages}
  onSend={(messageOrText) => {
    if (typeof messageOrText === 'string') {
      // lightweight convenience: composer returns text; build a Message
      const m: Message = { id: String(Date.now()), author: 'user', timestamp: new Date().toISOString(), parts: [{ kind: 'text', text: messageOrText }] };
      setMessages(prev => [...prev, m]);
    } else {
      setMessages(prev => [...prev, messageOrText]);
    }
  }}
/>
```

The component uses the `Chat` registry pattern — a serializable message transcript contains `Message` objects with `parts` where each part has a `kind`. A registry maps `kind -> renderer` to render parts without embedding JSX/closures inside the transcript.

The project includes minimal stories (storybook) and tests in `Chat.stories.tsx` and `Chat.test.tsx` in this folder.

The component respects theming tokens via CSS variables (e.g., `--pxt-neutral-background1`, `--pxt-primary-background`). See `react-common/styles/theming/base-theme.less` for available tokens.

Accessibility notes:

- The message container uses `role="log"` and `aria-live="polite"`.
- The composer uses a standard `textarea` with keyboard send (`Enter`) and `Shift+Enter` for newline.
- Images include `alt` text when available.

Serialization:

- `exportEnvelope` / `importEnvelope` helpers provide a typed export/import boundary for transcripts. Attachments are referenced by `contentId` and handled via an optional attachment manifest.

Migration:

- Parts may include `version` and registry entries can provide a `migrate` hook. The current default schema version is exported from `chat.types.ts` as `CHAT_SCHEMA_VERSION`.

Notes/TODOs:

- The list uses a small tail-window windowing strategy; swap in a dedicated virtualizer later for heavy transcripts.
- Registry `card` entries are demonstrated via a small demo card; consumers should register target-specific cards with stateful behavior using the provided `updateUiState` callback.
