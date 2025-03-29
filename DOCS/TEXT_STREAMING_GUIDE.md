# Text Streaming in Conversational AI Applications

This guide supplements the main [Conversational AI Guide](./GUIDE.md) and is focused specifically on implementing text streaming alongside real-time conversational AI audio streams.

Text streaming provides users with a visual representation of the conversation, improving accessibility and enhancing the overall user experience. While voice interactions are the most natural way to communicate there are various instances where you might want to suppliment the audio output, to include text:

1. **Accessibility**: Text makes the application usable for people with hearing impairments
2. **Reference**: Users can refer back to what was said without relying on memory
3. **Noisy environments**: Text becomes crucial when users can't clearly hear audio
4. **Verification**: Seeing words ensures users that the system understood them correctly
5. **Multi-modal interactions**: Some information is better consumed visually (e.g., lists, URLs)

## Architecture Overview

The text streaming implementation consists of three main components:

1. **Message Engine** (`lib/message.ts`): Core component that processes, manages, and maintains the state of text messages. This file is provided by Agora.
2. **Text Chat Component** (`components/Text-Chat.tsx`): UI component that renders messages and handles user interactions (this is our custom component for this example, you will create your own based on your use-case.)
3. **Conversation Component** (`components/ConversationComponent.tsx`): Orchestrates RTC connections, microphone controls, and integrates Text Chat. (This is the existing component that handles the audio and streaming)

How these components interact:

```
┌─────────────────────┐      ┌─────────────────────┐
│                     │      │                     │
│  Agora RTC Client   │◄────►│   MessageEngine     │
│                     │      │                     │
└─────────────────────┘      └─────────────────┬───┘
          ▲                                    │
          │                                    │ Updates
          │                                    ▼
┌─────────┴───────────┐      ┌─────────────────────┐
│                     │      │                     │
│ConversationComponent│──────►     Text Chat       │
│                     │      │                     │
└─────────────────────┘      └─────────────────────┘
```

## Message Flow

Understanding how messages flow through the system is crucial for implementation:

```
RTC Stream → Message Processing → Message Queue → State Updates → UI Rendering
```

1. **RTC Stream**: Raw data chunks arrive via the Agora RTC client
2. **Message Processing**: The MessageEngine decodes and processes these chunks
3. **Message Queue**: Processed messages enter a queue for orderly handling
4. **State Updates**: The ConversationComponent receives updated message lists
5. **UI Rendering**: The TextChat component displays the messages with appropriate styling

This flow ensures that streaming text is processed efficiently and displayed to the user in real-time, with proper handling of in-progress, completed, and interrupted messages.

## Message Types and Processing

The MessageEngine handles several types of messages, each requiring specific processing:

### User Transcriptions

```typescript
export interface IUserTranscription extends ITranscriptionBase {
  object: ETranscriptionObjectType.USER_TRANSCRIPTION; // "user.transcription"
  final: boolean;
}
```

### Agent (AI) Transcriptions

```typescript
export interface IAgentTranscription extends ITranscriptionBase {
  object: ETranscriptionObjectType.AGENT_TRANSCRIPTION; // "assistant.transcription"
  quiet: boolean;
  turn_seq_id: number;
  turn_status: EMessageStatus;
}
```

### Message Interruptions

```typescript
export interface IMessageInterrupt {
  object: ETranscriptionObjectType.MSG_INTERRUPTED; // "message.interrupt"
  message_id: string;
  data_type: 'message';
  turn_id: number;
  start_ms: number;
  send_ts: number;
}
```

Each message type goes through specific processing paths in the MessageEngine:

- **User Transcriptions**: Usually processed as complete messages without streaming
- **Agent Transcriptions**: Often processed word-by-word for streaming display
- **Message Interruptions**: Trigger status changes in existing messages

The MessageEngine maintains an internal queue and state to handle these different message types seamlessly.

## The Message Engine

The Message Engine is the core of text streaming functionality. It handles:

1. Processing incoming RTC messages containing transcriptions
2. Managing message state (in-progress, complete, interrupted)
3. Ordering and buffering messages
4. Notifying subscribers when message state changes

### Key Concepts in MessageEngine

#### Message Status

Messages in the system can have three states:

```typescript
export enum EMessageStatus {
  IN_PROGRESS = 0, // Message is still being processed/streamed
  END = 1, // Message has completed normally
  INTERRUPTED = 2, // Message was interrupted before completion
}
```

#### Message Engine Modes

The engine supports different rendering modes for flexibility:

```typescript
export enum EMessageEngineMode {
  TEXT = 'text', // Processes messages as complete text blocks
  WORD = 'word', // Processes messages word by word, enabling granular control
  AUTO = 'auto', // Automatically determines the most suitable mode
}
```

#### Message Interface

Messages are represented with a simple interface:

```typescript
export interface IMessageListItem {
  uid: number; // Unique identifier for the message sender (0 for AI agent)
  turn_id: number; // ID representing the turn/sequence in conversation
  text: string; // The actual message content/transcript
  status: EMessageStatus; // Current status of the message
}
```

### Initializing the Message Engine

Initialize the Message Engine inside the `ConversationComponent` after the Agora RTC client is ready:

```typescript
// Inside ConversationComponent
useEffect(() => {
  if (client && !messageEngineRef.current) {
    // Create message engine with AUTO mode for adaptive rendering
    const messageEngine = new MessageEngine(
      client,
      EMessageEngineMode.AUTO,
      // Callback to handle message list updates
      (updatedMessages: IMessageListItem[]) => {
        // Sort messages by turn_id to maintain order
        const sortedMessages = [...updatedMessages].sort(
          (a, b) => a.turn_id - b.turn_id
        );

        // Find the latest in-progress message
        const inProgressMsg = sortedMessages.find(
          (msg) => msg.status === EMessageStatus.IN_PROGRESS
        );

        // Update states
        setMessageList(
          sortedMessages.filter(
            (msg) => msg.status !== EMessageStatus.IN_PROGRESS
          )
        );
        setCurrentInProgressMessage(inProgressMsg || null);
      }
    );

    messageEngineRef.current = messageEngine;
    messageEngineRef.current.run({ legacyMode: false });
  }

  // Cleanup on unmount
  return () => {
    if (messageEngineRef.current) {
      messageEngineRef.current.cleanup();
      messageEngineRef.current = null;
    }
  };
}, [client]);
```

## UI Component

The `TextChat` component is a simple UI for displaying conversation text. It handles both completed messages and text streaming in, creating a responsive chat experience.

### Component Features

The TextChat component implements several key features essential for a good chat experience:

1. **Rendering of messages**: Displays both completed messages and actively streaming messages
2. **Distinctive styling**: Visually differentiates between user and AI messages
3. **Collapsible interface**: Can be expanded or collapsed based on user preference
4. **Smart auto-scrolling**: Automatically scrolls to show new content while respecting user actions
5. **Streaming indicators**: Visual cues showing when messages are being generated
6. **Expandable view**: Can toggle between compact and expanded modes

### Component Props

The component accepts three key properties:

```typescript
interface TextChatProps {
  messageList: IMessageListItem[]; // Array of completed messages
  currentInProgressMessage?: IMessageListItem | null; // Currently streaming message
  agentUID: string | undefined; // UID of the AI agent for message styling
}
```

### Key Functionality

Let's examine the key methods that power the TextChat component:

#### Manual and Automatic Scrolling

The component intelligently handles scrolling to ensure new messages are visible:

```typescript
// Scroll to bottom function for direct calls
const scrollToBottom = () => {
  if (scrollRef.current) {
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }
};

// Detect when user scrolls to determine auto-scroll behavior
const handleScroll = () => {
  if (scrollRef.current) {
    const { scrollHeight, scrollTop, clientHeight } = scrollRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 100;
    setShouldAutoScroll(isAtBottom);
  }
};
```

The `scrollToBottom` function directly controls scrolling, while `handleScroll` detects user scroll behavior to determine if auto-scrolling should be enabled (when the user is already near the bottom) or disabled (when the user has scrolled up to read earlier messages).

#### Detecting Significant Content Changes

To avoid too-frequent scrolling during streaming, the component checks for meaningful changes in the streamed content:

```typescript
// Check if streaming content has significantly changed
const hasContentChanged = () => {
  if (!currentInProgressMessage) return false;

  const currentText = currentInProgressMessage.text || '';
  const textLengthDiff = currentText.length - prevMessageTextRef.current.length;

  // Consider significant change if more than 20 new characters
  const hasSignificantChange = textLengthDiff > 20;

  // Update reference
  if (hasSignificantChange) {
    prevMessageTextRef.current = currentText;
  }

  return hasSignificantChange;
};
```

This prevents continuous scrolling with every small update, creating a smoother experience as the AI's message streams in.

#### Showing Streaming Messages

The component determines whether to show a streaming message:

```typescript
const shouldShowStreamingMessage = () => {
  return (
    currentInProgressMessage !== null &&
    currentInProgressMessage.status === EMessageStatus.IN_PROGRESS &&
    currentInProgressMessage.text.trim().length > 0
  );
};
```

This ensures we only display streaming messages that are actually in progress and have content.

#### Toggle Controls

The component has two toggle controls for the chat interface:

```typescript
// Toggle chat open/closed
const toggleChat = () => {
  setIsOpen(!isOpen);
  // If opening the chat, consider it as having seen the first message
  if (!isOpen) {
    hasSeenFirstMessageRef.current = true;
  }
};

// Toggle between normal and expanded mode
const toggleChatExpanded = () => {
  setIsChatExpanded(!isChatExpanded);
};
```

### Auto-Opening the Chat

The chat automatically opens when the first message appears:

```typescript
// Effect for auto-opening chat when first streaming message arrives
useEffect(() => {
  // Check if this is the first message and chat should be opened
  const hasNewMessage = messageList.length > 0;
  const hasInProgressMessage =
    shouldShowStreamingMessage() && currentInProgressMessage !== null;

  if (
    (hasNewMessage || hasInProgressMessage) &&
    !hasSeenFirstMessageRef.current &&
    !isOpen
  ) {
    setIsOpen(true);
    hasSeenFirstMessageRef.current = true;
  }
}, [messageList, currentInProgressMessage]);
```

### Smart Auto-Scrolling

The component implements auto-scrolling behavior:

```typescript
useEffect(() => {
  // Auto-scroll in these cases:
  // 1. New complete message arrived
  // 2. User is already at bottom
  // 3. Streaming content has changed significantly
  const hasNewMessage = messageList.length > prevMessageLengthRef.current;
  const hasStreamingChange = hasContentChanged();

  if (
    (hasNewMessage || shouldAutoScroll || hasStreamingChange) &&
    scrollRef.current
  ) {
    // Use direct scroll to bottom for more reliable scrolling
    scrollToBottom();
  }

  prevMessageLengthRef.current = messageList.length;
}, [messageList, currentInProgressMessage?.text, shouldAutoScroll]);

// Extra safety: ensure scroll happens after content renders during active streaming
useEffect(() => {
  if (
    currentInProgressMessage?.status === EMessageStatus.IN_PROGRESS &&
    shouldAutoScroll
  ) {
    const timer = setTimeout(scrollToBottom, 100);
    return () => clearTimeout(timer);
  }
}, [currentInProgressMessage?.text]);
```

This approach achieves a few distict UX goals:

- New messages are always visible
- The view follows streaming text as it's generated
- User scroll position is respected when reading previous messages
- Scroll behavior stays smooth during active streaming

### Full Component Implementation

Here's the complete TextChat component implementation:

```typescript
'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import {
  MessageCircle,
  X,
  UnfoldVertical,
  ChevronsDownUp,
  ArrowDownFromLine,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { IMessageListItem, EMessageStatus } from '@/lib/message';

interface TextChatProps {
  messageList: IMessageListItem[];
  currentInProgressMessage?: IMessageListItem | null;
  agentUID: string | undefined;
}

export default function TextChat({
  messageList,
  currentInProgressMessage = null,
  agentUID,
}: TextChatProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastMessageRef = useRef<HTMLDivElement>(null);
  const prevMessageLengthRef = useRef(messageList.length);
  const prevMessageTextRef = useRef('');
  const [isChatExpanded, setIsChatExpanded] = useState(false);
  const hasSeenFirstMessageRef = useRef(false);

  // Scroll to bottom function for direct calls
  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  };

  const handleScroll = () => {
    if (scrollRef.current) {
      const { scrollHeight, scrollTop, clientHeight } = scrollRef.current;
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 100;
      setShouldAutoScroll(isAtBottom);
    }
  };

  // Check if streaming content has significantly changed
  const hasContentChanged = () => {
    if (!currentInProgressMessage) return false;

    const currentText = currentInProgressMessage.text || '';
    const textLengthDiff =
      currentText.length - prevMessageTextRef.current.length;

    // Consider significant change if more than 20 new characters
    const hasSignificantChange = textLengthDiff > 20;

    // Update reference
    if (hasSignificantChange) {
      prevMessageTextRef.current = currentText;
    }

    return hasSignificantChange;
  };

  // Effect for auto-opening chat when first streaming message arrives
  useEffect(() => {
    // Check if this is the first message and chat should be opened
    const hasNewMessage = messageList.length > 0;
    const hasInProgressMessage =
      shouldShowStreamingMessage() && currentInProgressMessage !== null;

    if (
      (hasNewMessage || hasInProgressMessage) &&
      !hasSeenFirstMessageRef.current &&
      !isOpen
    ) {
      setIsOpen(true);
      hasSeenFirstMessageRef.current = true;
    }
  }, [messageList, currentInProgressMessage]);

  useEffect(() => {
    // Auto-scroll in these cases:
    // 1. New complete message arrived
    // 2. User is already at bottom
    // 3. Streaming content has changed significantly
    const hasNewMessage = messageList.length > prevMessageLengthRef.current;
    const hasStreamingChange = hasContentChanged();

    if (
      (hasNewMessage || shouldAutoScroll || hasStreamingChange) &&
      scrollRef.current
    ) {
      // Use direct scroll to bottom for more reliable scrolling
      scrollToBottom();
    }

    prevMessageLengthRef.current = messageList.length;
  }, [messageList, currentInProgressMessage?.text, shouldAutoScroll]);

  // Extra safety: ensure scroll happens after content renders during active streaming
  useEffect(() => {
    if (
      currentInProgressMessage?.status === EMessageStatus.IN_PROGRESS &&
      shouldAutoScroll
    ) {
      const timer = setTimeout(scrollToBottom, 100);
      return () => clearTimeout(timer);
    }
  }, [currentInProgressMessage?.text]);

  const shouldShowStreamingMessage = () => {
    return (
      currentInProgressMessage !== null &&
      currentInProgressMessage.status === EMessageStatus.IN_PROGRESS &&
      currentInProgressMessage.text.trim().length > 0
    );
  };

  // Toggle chat open/closed
  const toggleChat = () => {
    setIsOpen(!isOpen);
    // If opening the chat, consider it as having seen the first message
    if (!isOpen) {
      hasSeenFirstMessageRef.current = true;
    }
  };

  const toggleChatExpanded = () => {
    setIsChatExpanded(!isChatExpanded);
  };

  // Combine complete messages with in-progress message for rendering
  const allMessages = [...messageList];
  if (shouldShowStreamingMessage() && currentInProgressMessage) {
    allMessages.push(currentInProgressMessage);
  }

  return (
    <div id="chatbox" className="fixed bottom-24 right-8 z-50">
      {isOpen ? (
        <div
          className={cn(
            'bg-white rounded-lg shadow-lg w-96 flex flex-col text-black chatbox',
            isChatExpanded && 'expanded'
          )}
        >
          <div className="p-2 border-b flex justify-between items-center shrink-0">
            <Button variant="ghost" size="icon" onClick={toggleChatExpanded}>
              {isChatExpanded ? (
                <ArrowDownFromLine className="h-4 w-4" />
              ) : (
                <UnfoldVertical className="h-4 w-4" />
              )}
            </Button>
            <h3 className="font-semibold">Chat</h3>
            <Button variant="ghost" size="icon" onClick={toggleChat}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div
            className="flex-1 overflow-auto"
            ref={scrollRef}
            onScroll={handleScroll}
          >
            <div className="p-4 space-y-4">
              {allMessages.map((message, index) => (
                <div
                  key={`${message.turn_id}-${message.uid}-${message.status}`}
                  ref={index === allMessages.length - 1 ? lastMessageRef : null}
                  className={cn(
                    'flex items-start gap-2 w-full',
                    message.uid === 0 || message.uid.toString() === agentUID
                      ? 'flex-row'
                      : 'flex-row-reverse'
                  )}
                >
                  {/* Avatar */}
                  <div
                    className={cn(
                      'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium',
                      message.uid === 0 || message.uid.toString() === agentUID
                        ? 'bg-purple-100 text-purple-700'
                        : 'bg-blue-100 text-blue-700'
                    )}
                  >
                    {message.uid === 0 || message.uid.toString() === agentUID
                      ? 'AI'
                      : 'U'}
                  </div>

                  {/* Message content */}
                  <div
                    className={cn(
                      'flex',
                      message.uid === 0 || message.uid.toString() === agentUID
                        ? 'flex-col items-start'
                        : 'flex-col items-end'
                    )}
                  >
                    <div
                      className={cn(
                        'rounded-[15px] px-3 py-2',
                        message.uid === 0 || message.uid.toString() === agentUID
                          ? 'bg-gray-100 text-left'
                          : 'bg-blue-500 text-white text-right',
                        message.status === EMessageStatus.IN_PROGRESS &&
                          'animate-pulse'
                      )}
                    >
                      {message.text}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <Button
          onClick={toggleChat}
          className="rounded-full w-12 h-12 flex items-center justify-center bg-white hover:invert hover:border-2 hover:border-black hover:scale-150 transition-all duration-300"
        >
          <MessageCircle className="h-6 w-6 text-black" />
        </Button>
      )}
    </div>
  );
}
```

This component:

1. **Renders a chat bubble button** when collapsed
2. **Expands to a full chat window** when clicked
3. **Tracks and manages scroll behavior** to provide a smooth user experience
4. **Displays messages with appropriate styling** based on their source (user or AI)
5. **Adds visual indicators for streaming messages**
6. **Supports expanding/collapsing the full chat view**

The component's design and functionality allow it to work seamlessly with the MessageEngine, displaying both completed messages and real-time streaming content as it arrives from the AI.

## Integrating Text Chat into Your Application

To integrate the text streaming component into your application:

1. **Initialize the MessageEngine** with your Agora RTC client
2. **Maintain message state** in your parent component
3. **Render the TextChat component** with the current messages

Here's how the ConversationComponent integrates TextChat:

```typescript
return (
  <div className="flex flex-col gap-6 p-4 h-full">
    {/* Other UI components (connection status, remote users, etc.) */}

    {/* Text chat component */}
    <TextChat
      messageList={messageList}
      currentInProgressMessage={currentInProgressMessage}
      agentUID={agentUID}
    />
  </div>
);
```

## Styling and Customization

### Styling Message Bubbles

The TextChat component uses conditional styling to differentiate between user and AI messages:

```typescript
<div
  className={cn(
    'rounded-[15px] px-3 py-2',
    message.uid === 0 || message.uid.toString() === agentUID
      ? 'bg-gray-100 text-left'
      : 'bg-blue-500 text-white text-right',
    message.status === EMessageStatus.IN_PROGRESS && 'animate-pulse'
  )}
>
  {message.text}
</div>
```

You can customize these styles by modifying the classes or replacing them with your own design system.

### Chat Expansion States

The chat supports collapsed, normal, and expanded states:

```typescript
const toggleChat = () => {
  setIsOpen(!isOpen);
  if (!isOpen) {
    hasSeenFirstMessageRef.current = true;
  }
};

const toggleChatExpanded = () => {
  setIsChatExpanded(!isChatExpanded);
};
```

### Streaming Animation

In-progress messages have a subtle pulse animation to indicate they're still being generated:

```typescript
message.status === EMessageStatus.IN_PROGRESS && 'animate-pulse';
```

## Best Practices for Text Streaming

1. **Always show progress**: Use visual indicators to show that text is being generated
2. **Handle interruptions gracefully**: Interrupted messages should be visually distinct
3. **Optimize for readability**: Use appropriate fonts, sizes and contrast
4. **Respect user scroll**: Don't force scroll if the user has scrolled up to read previous messages
5. **Support text selection**: Allow users to copy text from the conversation
6. **Provide clear sender identification**: Visually distinguish between user and AI messages

## Accessibility Considerations

To ensure your text streaming component is accessible:

1. **Use sufficient contrast**: Ensure text is readable against background colors
2. **Support keyboard navigation**: Chat should be navigable without a mouse
3. **Add ARIA labels**: For chat toggle buttons and other interactive elements
4. **Support screen readers**: Ensure messages are properly announced
5. **Add timestamps** (optional): For longer conversations, timestamps help with context

## Troubleshooting

### Common Issues

1. **Messages not appearing**:

   - Check if the MessageEngine is properly initialized with the RTC client
   - Verify the callback function is updating state correctly

2. **Scroll jumping issues**:

   - Ensure the scroll containment and timing logic is working correctly
   - Check for height calculation issues in the chat container

3. **Performance with long conversations**:
   - Consider implementing message pagination for very long conversations
   - Use virtualization for large numbers of messages

## Next Steps

Adding text streaming to your Agora-powered conversational AI application significantly elevates the experience for your users. As you continue developing your conversational AI application with Agora customize the features and concepts to fit your use-case and refine your UI/UX based on actual usage patterns. By leveraging Agora's powerful RTC capabilities alongside this text streaming implementation, you've created an experience that feels both cutting-edge and accessible.

For more details check out Agora's [Official Documentation for "Live Subtitles"](https://docs.agora.io/en/conversational-ai/develop/subtitles?platform=web).
