# Build a Conversational AI App with Next.js and Agora

Conversational AI is all the hype. It allows you to have a real-time conversation with an AI agent, and actually get something done without wasting time typing out your thoughts and trying to format them into a clever prompt. It's a major shift in the way people interact with AI.

But given the investment that developers and businesses have made in building their own text based agents that run through custom LLM workflows, there's reluctance to adopt this new paradigm. Especially if it means having to give up all that investment or event worse, hobble it by only connecting them as tools/function calls.

This is why we built the Agora Conversational AI Engine. It allows you to connect your existing LLM workflows to an Agora channel, and have a real-time conversation with the AI agent.

In this guide, we'll build a real-time audio conversation application that connects users with an AI agent powered by Agora's Conversational AI Engine. The app will be built with NextJS, React, and TypeScript. We'll take an incremental approach, starting with the core real-time communication components and then add-in Agora's Convo AI Engine.

By the end of this guide, you will have a real-time audio conversation application that connects users with an AI agent powered by Agora's Conversational AI Engine.

## Prerequisites

Before starting, for the guide you're going to need to have:

- Node.js (v18 or higher)
- A basic understanding of React with TypeScript and NextJS.
- [An Agora account](https://console.agora.io/signup) - _first 10k minutes each month are free_
- Conversational AI service [activated on your AppID](https://console.agora.io/)

## Project Setup

Let's start by creating a new NextJS project with TypeScript support.

```bash
pnpm create next-app@latest ai-conversation-app
cd ai-conversation-app
```

When prompted, select these options:

- TypeScript: <u>Yes</u>
- ESLint: <u>Yes</u>
- Tailwind CSS: <u>Yes</u>
- Use `src/` directory: <u>No</u>
- App Router: <u>Yes</u>
- Use Turbopack: <u>No</u>
- Customize import alias: <u>Yes</u> (use the default `@/*`)

Next, install the required Agora dependencies:

- Agora's React SDK: [agora-rtc-react](https://www.npmjs.com/package/agora-rtc-react)
- Agora's Token Builder: [agora-token](https://www.npmjs.com/package/agora-token)

```bash
pnpm add agora-rtc-react agora-token
```

For UI components, we'll use shadcn/ui in this guide, but you can use any UI library of your choice or create custom components:

```bash
pnpm dlx shadcn@latest init
```

For this guide, we'll also use Lucide icons, so install that too:

```bash
pnpm add lucide-react
```

As we go through this guide, you'll have to create new files in specific directories. So, before we start let's create these new directories.

In your project root directory, create the `app/api/`, `components/`, and `types/` directories, and add the `.env.local` file:

```bash
mkdir app/api components types
touch .env.local
```

Your project directory should now have a structure like this:

```
├── app/
│   ├── api/
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── components/
├── types/
├── .env.local
└── (... Existing files and directories)
```

## Landing Page Component

Let's begin by setting up our landing page that initializes the Agora client and sets up the `AgoraProvider`.

Create the `LandingPage` component file at `components/LandingPage.tsx`:

```bash
touch components/LandingPage.tsx
```

For now we'll keep this component simple, and fill it in with more functionality as we progress through the guide. I've included comments throughout the code to help you understand what's happening. At a high level, we're importing the Agora React SDK and creating the AgoraRTC client, and then passing it to the `AgoraProvider` so all child components use the same `client` instance.

Add the following code to the `LandingPage.tsx` file:

```typescript
'use client';

import { useState, useMemo } from 'react';
import dynamic from 'next/dynamic';

// Agora requires access to the browser's WebRTC API,
// - which throws an error if it's loaded via SSR
// Create a component that has SSR disabled,
// - and use it to load the AgoraRTC components on the client side
const AgoraProvider = dynamic(
  async () => {
    // Dynamically import Agora's components
    const { AgoraRTCProvider, default: AgoraRTC } = await import(
      'agora-rtc-react'
    );

    return {
      default: ({ children }: { children: React.ReactNode }) => {
        // Create the Agora RTC client once using useMemo
        const client = useMemo(
          () => AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' }),
          []
        );

        // The provider makes the client available to all child components
        return <AgoraRTCProvider client={client}>{children}</AgoraRTCProvider>;
      },
    };
  },
  { ssr: false } // Important: disable SSR for this component
);

export default function LandingPage() {
  // Basic setup, we'll add more functionality as we progress through the guide.
  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      <h1 className="text-4xl font-bold mb-6 text-center">
        Agora AI Conversation
      </h1>

      <div className="max-w-4xl mx-auto">
        <p className="text-lg mb-6 text-center">
          When was the last time you had an intelligent conversation?
        </p>

        {/* Placeholder for our start conversation button */}
        <div className="flex justify-center mb-8">
          <button className="px-6 py-3 bg-yellow-600 text-white rounded-lg">
            Start Conversation
          </button>
        </div>

        <AgoraProvider>
          <div>PLACEHOLDER: We'll add the conversation component here</div>
        </AgoraProvider>
      </div>
    </div>
  );
}
```

Now update your `app/page.tsx` file to use this landing page:

```typescript
import LandingPage from '@/components/LandingPage';

export default function Home() {
  return <LandingPage />;
}
```

## Basic Agora React JS Implementation

With the landing page setup we can focus on implmenting Agora's React JS SDK to handle the core RTC functionality, like joining a channel, publishing audio, receiving audio, and handling the Agora SDK events.

Create a file at `components/ConversationComponent.tsx`,

```bash
touch components/ConversationComponent.tsx
```

Add the following code:

```typescript
'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  useRTCClient,
  useLocalMicrophoneTrack,
  useRemoteUsers,
  useClientEvent,
  useIsConnected,
  useJoin,
  usePublish,
  RemoteUser,
  UID,
} from 'agora-rtc-react';

export default function ConversationComponent() {
  // Access the client from the provider context
  const client = useRTCClient();

  // Track connection status
  const isConnected = useIsConnected();

  // Manage microphone state
  const [isEnabled, setIsEnabled] = useState(true);
  const { localMicrophoneTrack } = useLocalMicrophoneTrack(isEnabled);

  // Track remote users (like our AI agent)
  const remoteUsers = useRemoteUsers();

  // Join the channel when component mounts
  const { isConnected: joinSuccess } = useJoin(
    {
      appid: process.env.NEXT_PUBLIC_AGORA_APP_ID!, // Load APP_ID from env.local
      channel: 'test-channel',
      token: 'replace-with-token',
      uid: 0, // Join with UID 0 and Agora will assign a unique ID when the user joins
    },
    true // Join automatically when the component mounts
  );

  // Publish our microphone track to the channel
  usePublish([localMicrophoneTrack]);

  // Set up event handlers for client events
  useClientEvent(client, 'user-joined', (user) => {
    console.log('Remote user joined:', user.uid);
  });

  useClientEvent(client, 'user-left', (user) => {
    console.log('Remote user left:', user.uid);
  });

  // Toggle microphone on/off
  const toggleMicrophone = async () => {
    if (localMicrophoneTrack) {
      await localMicrophoneTrack.setEnabled(!isEnabled);
      setIsEnabled(!isEnabled);
    }
  };

  // Clean up when component unmounts
  useEffect(() => {
    return () => {
      client?.leave(); // Leave the channel when the component unmounts
    };
  }, [client]);

  return (
    <div className="p-4 bg-gray-800 rounded-lg">
      <div className="mb-4">
        <p className="text-white">
          {/* Display the connection status */}
          Connection Status: {isConnected ? 'Connected' : 'Disconnected'}
        </p>
      </div>

      {/* Display remote users */}
      <div className="mb-4">
        {remoteUsers.length > 0 ? (
          remoteUsers.map((user) => (
            <div
              key={user.uid}
              className="p-2 bg-gray-700 rounded mb-2 text-white"
            >
              <RemoteUser user={user} />
            </div>
          ))
        ) : (
          <p className="text-gray-400">No remote users connected</p>
        )}
      </div>

      {/* Microphone control */}
      <button
        onClick={toggleMicrophone}
        className={`px-4 py-2 rounded ${
          isEnabled ? 'bg-green-500' : 'bg-red-500'
        } text-white`}
      >
        Microphone: {isEnabled ? 'On' : 'Off'}
      </button>
    </div>
  );
}
```

This component is the foundation for our real-time audio communication, so let's recap the Agora React hooks that we're using:

- `useRTCClient`: Gets access to the Agora RTC client from the provider we set up in the landing page
- `useLocalMicrophoneTrack`: Creates and manages the user's microphone input
- `useRemoteUsers`: Keeps track of other users in the channel (our AI agent will appear here)
- `useJoin`: Handles joining the channel with the specified parameters
- `usePublish`: Publishes our audio track to the channel so others can hear us
- `useClientEvent`: Sets up event handlers for important events like users joining or leaving

> **Note:** We are loading the `APP_ID` from the environment variables using the non-null assertion operator, so make sure to set it in `.env.local` file.

We need to add this component to our `LandingPage.tsx` file. Start by importing the component, and then add it to the AgoraProvider component.

```typescript
// Previous imports remain the same as before...
// Dynamically import the ConversationComponent with ssr disabled
const ConversationComponent = dynamic(() => import('./ConversationComponent'), {
  ssr: false,
});
// Previous code remains the same as before...
<AgoraProvider>
  <ConversationComponent />
</AgoraProvider>;
```

Next, we'll implement token authentication, to add a layer of security to our application.

## 4. Token Generation and Management

The Agora team strongly recommends using token-based authentication for all your apps, especially in production environments. In this step, we'll create a route to generate these tokens and update our `LandingPage` and `ConversationComponent` to use them.

### Token Generation Route

Let's break down what the token generation route needs to do:

1. Generate a secure Agora token using our App ID and Certificate
2. Create a unique channel name for each conversation
3. Return token, along with the channel name, and UID we used to generate it, back to the client
4. Support token refresh, using existing channel name and UID

Create a new file at `app/api/generate-agora-token/route.ts`:

```bash
mkdir app/api/generate-agora-token
touch app/api/generate-agora-token/route.ts
```

Add the following code:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { RtcTokenBuilder, RtcRole } from 'agora-token';

// Access environment variables
const APP_ID = process.env.NEXT_PUBLIC_AGORA_APP_ID;
const APP_CERTIFICATE = process.env.NEXT_PUBLIC_AGORA_APP_CERTIFICATE;
const EXPIRATION_TIME_IN_SECONDS = 3600; // Token valid for 1 hour

// Helper function to generate unique channel names
function generateChannelName(): string {
  // Combine timestamp and random string for uniqueness
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `ai-conversation-${timestamp}-${random}`;
}

export async function GET(request: NextRequest) {
  console.log('Generating Agora token...');

  // Verify required environment variables are set
  if (!APP_ID || !APP_CERTIFICATE) {
    console.error('Agora credentials are not set');
    return NextResponse.json(
      { error: 'Agora credentials are not set' },
      { status: 500 }
    );
  }

  // Get query parameters (if any)
  const { searchParams } = new URL(request.url);
  const uidStr = searchParams.get('uid') || '0';
  const uid = parseInt(uidStr);

  // Use provided channel name or generate new one
  const channelName = searchParams.get('channel') || generateChannelName();

  // Calculate token expiration time
  const expirationTime =
    Math.floor(Date.now() / 1000) + EXPIRATION_TIME_IN_SECONDS;

  try {
    // Generate the token using Agora's SDK
    console.log('Building token with UID:', uid, 'Channel:', channelName);
    const token = RtcTokenBuilder.buildTokenWithUid(
      APP_ID,
      APP_CERTIFICATE,
      channelName,
      uid,
      RtcRole.PUBLISHER, // User can publish audio/video
      expirationTime,
      expirationTime
    );

    console.log('Token generated successfully');
    // Return the token and session information to the client
    return NextResponse.json({
      token,
      uid: uid.toString(),
      channel: channelName,
    });
  } catch (error) {
    console.error('Error generating Agora token:', error);
    return NextResponse.json(
      { error: 'Failed to generate Agora token', details: error },
      { status: 500 }
    );
  }
}
```

This route handles token generation for our application, so let's recap the important features:

- Generates a unique channel names using timestamps and random strings to avoid collisions
- Generates a secure token using the App ID and Certificate
- Accepts url parameters for refreshing tokens using an existing channel name and user ID

> **Note:** This route is loading the APP_ID and APP_CERTIFICATE from the environment variables, so make sure to set them in your `.env.local` file.

### Updating the Landing Page to Request Tokens

With the token route setup, let's update the landing page, to handle all token fetching logic. First, we'll need to create a new type definition for the token data, so we can use it in our component.

Create a file at `types/conversation.ts`:

```bash
touch types/conversation.ts
```

Add the following code:

```typescript
// Types for Agora token data
export interface AgoraLocalUserInfo {
  token: string;
  uid: string;
  channel: string;
  agentId?: string;
}
```

Open the `components/LandingPage.tsx` file, update the react imports, add the new import statement for the AgoraLocalUserInfo type, and update the entire `LandingPage()` function.

We'll use Suspense, because the Agora React SDK is dynamically loaded, and the conversation component needs some time to load, so it'll be good to show a loading state till its ready.

```typescript
'use client';

import { useState, useMemo, Suspense } from 'react'; // added Suspense
// Previous imports remain the same as before...
import type { AgoraLocalUserInfo } from '../types/conversation';

export default function LandingPage() {
  // Manage conversation state
  const [showConversation, setShowConversation] = useState(false);
  // Manage loading state, while the agent token is generated
  const [isLoading, setIsLoading] = useState(false);
  // Manage error state
  const [error, setError] = useState<string | null>(null);
  // Store the token data for the conversation
  const [agoraLocalUserInfo, setAgoraLocalUserInfo] =
    useState<AgoraLocalUserInfo | null>(null);

  const handleStartConversation = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Request a token from our API
      console.log('Fetching Agora token...');
      const agoraResponse = await fetch('/api/generate-agora-token');

      if (!agoraResponse.ok) {
        throw new Error('Failed to generate Agora token');
      }

      const responseData = await agoraResponse.json();
      console.log('Token response:', responseData);

      // Store the token data for the conversation
      setAgoraLocalUserInfo(responseData);

      // Show the conversation component
      setShowConversation(true);
    } catch (err) {
      setError('Failed to start conversation. Please try again.');
      console.error('Error starting conversation:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTokenWillExpire = async (uid: string) => {
    try {
      // Request a new token using the channel name and uid
      const response = await fetch(
        `/api/generate-agora-token?channel=${agoraLocalUserInfo?.channel}&uid=${uid}`
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error('Failed to generate new token');
      }

      return data.token;
    } catch (error) {
      console.error('Error renewing token:', error);
      throw error;
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-6 text-center">
          Agora Conversational AI
        </h1>

        <p className="text-lg mb-6 text-center">
          When was the last time you had an intelligent conversation?
        </p>

        {!showConversation ? (
          <div className="flex justify-center mb-8">
            <button
              onClick={handleStartConversation}
              disabled={isLoading}
              className="px-6 py-3 bg-yellow-600 text-white rounded-lg disabled:opacity-50"
            >
              {isLoading ? 'Starting...' : 'Start Conversation'}
            </button>
          </div>
        ) : agoraLocalUserInfo ? (
          <Suspense
            fallback={<p className="text-center">Loading conversation...</p>}
          >
            <AgoraProvider>
              <ConversationComponent
                agoraLocalUserInfo={agoraLocalUserInfo}
                onTokenWillExpire={handleTokenWillExpire}
                onEndConversation={() => setShowConversation(false)}
              />
            </AgoraProvider>
          </Suspense>
        ) : (
          <p className="text-center text-red-400">
            Failed to load conversation data.
          </p>
        )}

        {error && <p className="text-center text-red-400 mt-4">{error}</p>}
      </div>
    </div>
  );
}
```

> Don't worry about any errors or warnings on the ConversationComponent for now, we'll fix them in the next step.

### Updating the Conversation Component to Use Tokens

Now that we have token and channel name, lets create some props so we can pass them from the `LandingPage` to the `ConversationComponent`.

Open the `types/conversation.ts` file and add the following `interface`:

```typescript
// Props for our conversation component
export interface ConversationComponentProps {
  agoraLocalUserInfo: AgoraLocalUserInfo;
  onTokenWillExpire: (uid: string) => Promise<string>;
  onEndConversation: () => void;
}
```

Open the `ConversationComponent.tsx` file and update it to import and use the props we just created to join the channel. We'll also add the token-expiry event handler to handle token renewal, and a button to leave the conversation.

```typescript
// Previopus imports remain the same as before...
import type { ConversationComponentProps } from '../types/conversation'; // Import the new props

// Update the component to accept the new props
export default function ConversationComponent({
  agoraLocalUserInfo,
  onTokenWillExpire,
  onEndConversation,
}: ConversationComponentProps) {
  // The previous declarations remain the same as before
  const [joinedUID, setJoinedUID] = useState<UID>(0); // New: After joining the channel we'll store the uid for renewing the token

  // Update the useJoin hook to use the token and channel name from the props
  const { isConnected: joinSuccess } = useJoin(
    {
      appid: process.env.NEXT_PUBLIC_AGORA_APP_ID!,
      channel: agoraLocalUserInfo.channel, // Using the channel name received from the token response
      token: agoraLocalUserInfo.token, // Using the token we received
      uid: parseInt(agoraLocalUserInfo.uid), // Using uid 0 to join the channel, so Agora's system will create and return a uid for us
    },
    true
  );

  // Set the actualUID to the Agora generated uid once the user joins the channel
  useEffect(() => {
    if (joinSuccess && client) {
      const uid = client.uid;
      setJoinedUID(uid as UID);
      console.log('Join successful, using UID:', uid);
    }
  }, [joinSuccess, client]);

  /*
  Existing code remains the same as before:
  // Publish local microphone track
  // Handle remote user events
  // Handle remote user left event
*/

  // New: Add listener for connection state changes
  useClientEvent(client, 'connection-state-change', (curState, prevState) => {
    console.log(`Connection state changed from ${prevState} to ${curState}`);
  });

  // Add token renewal handler to avoid disconnections
  const handleTokenWillExpire = useCallback(async () => {
    if (!onTokenWillExpire || !joinedUID) return;
    try {
      // Request a new token from our API
      const newToken = await onTokenWillExpire(joinedUID.toString());
      await client?.renewToken(newToken);
      console.log('Successfully renewed Agora token');
    } catch (error) {
      console.error('Failed to renew Agora token:', error);
    }
  }, [client, onTokenWillExpire, joinedUID]);

  // New: Add listener for token privilege will expire event
  useClientEvent(client, 'token-privilege-will-expire', handleTokenWillExpire);

  /*
  Existing code remains the same as before:
  // Toggle microphone
  // Cleanup on unmount
*/

  //update the return statement to include new UI elements for leaving the conversation
  return (
    <div className="p-4 bg-gray-800 rounded-lg">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div
            className={`w-3 h-3 rounded-full ${
              isConnected ? 'bg-green-500' : 'bg-red-500'
            }`}
          />
          <span className="text-white">
            {isConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>

        <button
          onClick={onEndConversation}
          className="px-4 py-2 bg-red-500 text-white rounded"
        >
          End Conversation
        </button>
      </div>

      {/* Display remote users */}
      <div className="mb-4">
        <h2 className="text-xl mb-2 text-white">Remote Users:</h2>
        {remoteUsers.length > 0 ? (
          remoteUsers.map((user) => (
            <div
              key={user.uid}
              className="p-2 bg-gray-700 rounded mb-2 text-white"
            >
              <RemoteUser user={user} />
            </div>
          ))
        ) : (
          <p className="text-gray-400">No remote users connected</p>
        )}
      </div>

      {/* Microphone control */}
      <button
        onClick={toggleMicrophone}
        className={`px-4 py-2 rounded ${
          isEnabled ? 'bg-green-500' : 'bg-red-500'
        } text-white`}
      >
        Microphone: {isEnabled ? 'On' : 'Off'}
      </button>
    </div>
  );
}
```

### Quick Test

Now that we have our basic RTC functionality and token generation working, let's test the application.

1. Run the application using `pnpm run dev`
2. Open the application in your browser, using the url `http://localhost:3000`
3. Click on the "Start Conversation" button
4. You should see the connection status change to "Connected"

![Initial Test](assets/initial-test.gif)

## Add Agora's Conversational AI Engine

Now that we have the basic RTC functionality working, let's integrate Agora's Conversational AI service. In this next section we'll:

1. Create an API route for inviting the AI agent to our channel
2. Configure Agora Start Request, including our choice of LLM endpoint and TTS provider
3. Create a route for stopping the conversation

### Types Setup

Let's get the boring stuff out of the way first. Add some new types to the `types/conversation.ts` file:

```typescript
// Previous types remain the same as before...

// New types for the agent invitation API
export interface ClientStartRequest {
  requester_id: string;
  channel_name: string;
  rtc_codec?: number;
  input_modalities?: string[];
  output_modalities?: string[];
}

interface MicrosoftTTSParams {
  key: string;
  region: string;
  voice_name: string;
  rate?: number;
  volume?: number;
}

interface ElevenLabsTTSParams {
  key: string;
  voice_id: string;
  model_id: string;
}

export enum TTSVendor {
  Microsoft = 'microsoft',
  ElevenLabs = 'elevenlabs',
}

export interface TTSConfig {
  vendor: TTSVendor;
  params: MicrosoftTTSParams | ElevenLabsTTSParams;
}

// Agora API request body
export interface AgoraStartRequest {
  name: string;
  properties: {
    channel: string;
    token: string;
    agent_rtc_uid: string;
    remote_rtc_uids: string[];
    enable_string_uid?: boolean;
    idle_timeout?: number;
    advanced_features?: {
      enable_aivad?: boolean;
      enable_bhvs?: boolean;
    };
    asr: {
      language: string;
      task?: string;
    };
    llm: {
      url?: string;
      api_key?: string;
      system_messages: Array<{
        role: string;
        content: string;
      }>;
      greeting_message: string;
      failure_message: string;
      max_history?: number;
      input_modalities?: string[];
      output_modalities?: string[];
      params: {
        model: string;
        max_tokens: number;
        temperature?: number;
        top_p?: number;
      };
    };
    vad: {
      silence_duration_ms: number;
      speech_duration_ms?: number;
      threshold?: number;
      interrupt_duration_ms?: number;
      prefix_padding_ms?: number;
    };
    tts: TTSConfig;
  };
}

export interface StopConversationRequest {
  agent_id: string;
}

export interface AgentResponse {
  agent_id: string;
  create_ts: number;
  state: string;
}
```

These new types give some insight on all the parts we'll be assembling in the next steps. We'll take the client request, and use it to configure the AgoraStartRequest and send it to Agora's Conversational AI Engine. Agora's Convo AI engine will add the agent to the conversation.

### Invite Agent Route

Create the route file at `app/api/invite-agent/route.ts`:

```bash
mkdir app/api/invite-agent
touch app/api/invite-agent/route.ts
```

Add the following code:

```typescript
import { NextResponse } from 'next/server';
import { RtcTokenBuilder, RtcRole } from 'agora-token';
import {
  ClientStartRequest,
  AgentResponse,
  TTSVendor,
} from '@/types/conversation';

// Helper function to validate and get all configuration
function getValidatedConfig() {
  // Validate Agora Configuration
  const agoraConfig = {
    baseUrl: process.env.NEXT_PUBLIC_AGORA_CONVO_AI_BASE_URL || '',
    appId: process.env.NEXT_PUBLIC_AGORA_APP_ID || '',
    appCertificate: process.env.NEXT_PUBLIC_AGORA_APP_CERTIFICATE || '',
    customerId: process.env.NEXT_PUBLIC_AGORA_CUSTOMER_ID || '',
    customerSecret: process.env.NEXT_PUBLIC_AGORA_CUSTOMER_SECRET || '',
    agentUid: process.env.NEXT_PUBLIC_AGENT_UID || 'Agent',
  };

  if (Object.values(agoraConfig).some((v) => v === '')) {
    throw new Error('Missing Agora configuration. Check your .env.local file');
  }

  // Validate LLM Configuration
  const llmConfig = {
    url: process.env.NEXT_PUBLIC_LLM_URL,
    api_key: process.env.NEXT_PUBLIC_LLM_API_KEY,
    model: process.env.NEXT_PUBLIC_LLM_MODEL,
  };

  // Get TTS Vendor
  const ttsVendor =
    (process.env.NEXT_PUBLIC_TTS_VENDOR as TTSVendor) || TTSVendor.Microsoft;

  // Get Modalities Configuration
  const modalitiesConfig = {
    input: process.env.NEXT_PUBLIC_INPUT_MODALITIES?.split(',') || ['text'],
    output: process.env.NEXT_PUBLIC_OUTPUT_MODALITIES?.split(',') || [
      'text',
      'audio',
    ],
  };

  return {
    agora: agoraConfig,
    llm: llmConfig,
    ttsVendor,
    modalities: modalitiesConfig,
  };
}

// Helper function to get TTS configuration based on vendor
function getTTSConfig(vendor: TTSVendor) {
  if (vendor === TTSVendor.Microsoft) {
    return {
      vendor: TTSVendor.Microsoft,
      params: {
        key: process.env.NEXT_PUBLIC_MICROSOFT_TTS_KEY,
        region: process.env.NEXT_PUBLIC_MICROSOFT_TTS_REGION,
        voice_name:
          process.env.NEXT_PUBLIC_MICROSOFT_TTS_VOICE_NAME ||
          'en-US-AriaNeural',
        rate: parseFloat(process.env.NEXT_PUBLIC_MICROSOFT_TTS_RATE || '1.0'),
        volume: parseFloat(
          process.env.NEXT_PUBLIC_MICROSOFT_TTS_VOLUME || '100.0'
        ),
      },
    };
  } else if (vendor === TTSVendor.ElevenLabs) {
    return {
      vendor: TTSVendor.ElevenLabs,
      params: {
        key: process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY,
        model_id: process.env.NEXT_PUBLIC_ELEVENLABS_MODEL_ID,
        voice_id: process.env.NEXT_PUBLIC_ELEVENLABS_VOICE_ID,
      },
    };
  }

  throw new Error(`Unsupported TTS vendor: ${vendor}`);
}

export async function POST(request: Request) {
  try {
    // Get our configuration
    const config = getValidatedConfig();
    const body: ClientStartRequest = await request.json();
    const { requester_id, channel_name, input_modalities, output_modalities } =
      body;

    // Generate a unique token for the AI agent
    const timestamp = Date.now();
    const expirationTime = Math.floor(timestamp / 1000) + 3600;

    const token = RtcTokenBuilder.buildTokenWithUid(
      config.agora.appId,
      config.agora.appCertificate,
      channel_name,
      config.agora.agentUid,
      RtcRole.PUBLISHER,
      expirationTime,
      expirationTime
    );

    // Check if we're using string UIDs
    const isStringUID = (str: string) => /[a-zA-Z]/.test(str);

    // Create a descriptive name for this conversation
    const uniqueName = `conversation-${timestamp}-${Math.random()
      .toString(36)
      .substring(2, 8)}`;

    // Get the appropriate TTS configuration
    const ttsConfig = getTTSConfig(config.ttsVendor);

    // Prepare the request to the Agora Conversational AI API
    const requestBody = {
      name: uniqueName,
      properties: {
        channel: channel_name,
        token: token,
        agent_rtc_uid: config.agora.agentUid,
        remote_rtc_uids: [requester_id],
        enable_string_uid: isStringUID(config.agora.agentUid),
        idle_timeout: 30,
        // ASR (Automatic Speech Recognition) settings
        asr: {
          language: 'en-US',
          task: 'conversation',
        },
        // LLM (Large Language Model) settings
        llm: {
          url: config.llm.url,
          api_key: config.llm.api_key,
          system_messages: [
            {
              role: 'system',
              content:
                'You are a helpful assistant. Respond concisely and naturally as if in a spoken conversation.',
            },
          ],
          greeting_message: 'Hello! How can I assist you today?',
          failure_message: 'Please wait a moment while I process that.',
          max_history: 10,
          params: {
            model: config.llm.model || 'gpt-3.5-turbo',
            max_tokens: 1024,
            temperature: 0.7,
            top_p: 0.95,
          },
          input_modalities: input_modalities || config.modalities.input,
          output_modalities: output_modalities || config.modalities.output,
        },
        // VAD (Voice Activity Detection) settings
        vad: {
          silence_duration_ms: 480,
          speech_duration_ms: 15000,
          threshold: 0.5,
          interrupt_duration_ms: 160,
          prefix_padding_ms: 300,
        },
        // TTS (Text-to-Speech) settings
        tts: ttsConfig,
      },
    };

    // Send the request to the Agora API
    const response = await fetch(
      `${config.agora.baseUrl}/${config.agora.appId}/join`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${Buffer.from(
            `${config.agora.customerId}:${config.agora.customerSecret}`
          ).toString('base64')}`,
        },
        body: JSON.stringify(requestBody),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Agent start response:', {
        status: response.status,
        body: errorText,
      });
      throw new Error(
        `Failed to start conversation: ${response.status} ${errorText}`
      );
    }

    // Parse and return the response, which includes the agentID.
    // We'll need the agentID later, when its time to remove the agent.
    const data: AgentResponse = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error starting conversation:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to start conversation',
      },
      { status: 500 }
    );
  }
}
```

Since Agora supports multiple TTS providers, the TTS section includes the configuration for both Microsoft Azure TTS and ElevenLabs and uses the `TTSVendor` env variable to determine which TTS config to use.

Choose the TTS provider based on your needs. Once you choose a vendor, you'll also need to choose a voice. To help you get started, here are some links to the voice galleries for each provider:

- [Microsoft Azure TTS Voice Gallery](https://speech.microsoft.com/portal/voicegallery): Offers a wide range of natural-sounding voices.

- [ElevenLabs Voice Library](https://elevenlabs.io/voice-library): Known for highly realistic and emotional voices.

> **Note:** This route loads a number of environment variables. Make sure to set these in your `.env.local` file. At the end of this guide, I've included a list of all the environment variables you'll need to set.

### Stop Conversation Route

After the agent joins the conversation, we need a way to remove them from the conversation. This is where the `stop-conversation` route comes in, it takes the agentID and sends a request to the Agora's Conversational AI Engine to remove the agent from the channel.

Create a file at `app/api/stop-conversation/route.ts`:

```bash
mkdir app/api/stop-conversation
touch app/api/stop-conversation/route.ts
```

Add the following code:

```typescript
import { NextResponse } from 'next/server';
import { StopConversationRequest } from '@/types/conversation';

// Helper function to validate and get Agora configuration
function getValidatedConfig() {
  const agoraConfig = {
    baseUrl: process.env.NEXT_PUBLIC_AGORA_CONVO_AI_BASE_URL,
    appId: process.env.NEXT_PUBLIC_AGORA_APP_ID || '',
    customerId: process.env.NEXT_PUBLIC_AGORA_CUSTOMER_ID || '',
    customerSecret: process.env.NEXT_PUBLIC_AGORA_CUSTOMER_SECRET || '',
  };

  if (Object.values(agoraConfig).some((v) => !v || v.trim() === '')) {
    throw new Error('Missing Agora configuration. Check your .env.local file');
  }

  return agoraConfig;
}

export async function POST(request: Request) {
  try {
    const config = getValidatedConfig();
    const body: StopConversationRequest = await request.json();
    const { agent_id } = body;

    if (!agent_id) {
      throw new Error('agent_id is required');
    }

    // Create authentication header
    const plainCredential = `${config.customerId}:${config.customerSecret}`;
    const encodedCredential = Buffer.from(plainCredential).toString('base64');
    const authorizationHeader = `Basic ${encodedCredential}`;

    // Send request to Agora API to stop the conversation
    const response = await fetch(
      `${config.baseUrl}/${config.appId}/agents/${agent_id}/leave`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: authorizationHeader,
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Agent stop response:', {
        status: response.status,
        body: errorText,
      });
      throw new Error(
        `Failed to stop conversation: ${response.status} ${errorText}`
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error stopping conversation:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to stop conversation',
      },
      { status: 500 }
    );
  }
}
```

## Update the Client to Start and Stop the AI Agent

We'll update the `LandingPage` and `ConversationComponent` to add the ability to start and stop the AI agent.

### Updating the Landing Page to Invite the AI Agent

First, let's update our landing page to invite the AI agent after generating a token. This will run the invite request parallel to loading the `ConversationComponent`.

```typescript
// Previous imports remain the same as before...
// Add new imports for ClientStartRequest and AgentResponse
import type {
  AgoraLocalUserInfo,
  ClientStartRequest,
  AgentResponse,
} from '../types/conversation';

// Dynamically imports for ConversationComponent and AgoraProvider remain the same as before...

export default function LandingPage() {
  // previous state management code remains the same as before...
  const [agentJoinError, setAgentJoinError] = useState(false); // add agent join error state

  const handleStartConversation = async () => {
    setIsLoading(true);
    setError(null);
    setAgentJoinError(false);

    try {
      // Step 1: Get the Agora token (updated)
      console.log('Fetching Agora token...');
      const agoraResponse = await fetch('/api/generate-agora-token');
      const responseData = await agoraResponse.json();
      console.log('Agora API response:', responseData);

      if (!agoraResponse.ok) {
        throw new Error(
          `Failed to generate Agora token: ${JSON.stringify(responseData)}`
        );
      }

      // Step 2: Invite the AI agent to join the channel
      const startRequest: ClientStartRequest = {
        requester_id: responseData.uid,
        channel_name: responseData.channel,
        input_modalities: ['text'],
        output_modalities: ['text', 'audio'],
      };

      try {
        const response = await fetch('/api/invite-agent', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(startRequest),
        });

        if (!response.ok) {
          setAgentJoinError(true);
        } else {
          const agentData: AgentResponse = await response.json();
          // Store agent ID along with token data
          setAgoraLocalUserInfo({
            ...responseData,
            agentId: agentData.agent_id,
          });
        }
      } catch (err) {
        console.error('Failed to start conversation with agent:', err);
        setAgentJoinError(true);
      }

      // Show the conversation UI even if agent join fails
      // The user can retry connecting the agent from within the conversation
      setShowConversation(true);
    } catch (err) {
      setError('Failed to start conversation. Please try again.');
      console.error('Error starting conversation:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Token renewal code remains the same as before...

  // Updated return statement to show error if the agent join fails
  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      <div className="max-w-4xl mx-auto py-12">
        <h1 className="text-4xl font-bold mb-6 text-center">
          Agora AI Conversation
        </h1>

        <p className="text-lg mb-6 text-center">
          When was the last time you had an intelligent conversation?
        </p>

        {!showConversation ? (
          <>
            <div className="flex justify-center mb-8">
              <button
                onClick={handleStartConversation}
                disabled={isLoading}
                className="px-8 py-3 bg-yellow-600 hover:bg-yellow-700 text-white rounded-full shadow-lg disabled:opacity-50 transition-all"
              >
                {isLoading ? 'Starting...' : 'Start Conversation'}
              </button>
            </div>
            {error && <p className="text-center text-red-400 mt-4">{error}</p>}
          </>
        ) : agoraLocalUserInfo ? (
          <>
            {agentJoinError && (
              <div className="mb-4 p-3 bg-red-600/20 rounded-lg text-red-400 text-center">
                Failed to connect with AI agent. The conversation may not work
                as expected.
              </div>
            )}
            <Suspense
              fallback={
                <div className="text-center">Loading conversation...</div>
              }
            >
              <AgoraProvider>
                <ConversationComponent
                  agoraLocalUserInfo={agoraLocalUserInfo}
                  onTokenWillExpire={handleTokenWillExpire}
                  onEndConversation={() => setShowConversation(false)}
                />
              </AgoraProvider>
            </Suspense>
          </>
        ) : (
          <p className="text-center">Failed to load conversation data.</p>
        )}
      </div>
    </div>
  );
}
```

This updated landing page, now invites the AI agent to join the conversation and shows appropriate loading and error states if the agent can't join.

### Creating a Microphone Button Component

The microphone button is an essetial element of any audio first ui. So, we're going to create a simple button component that allows users to control their microphone.

Create a file at `components/MicrophoneButton.tsx`:

```bash
touch components/MicrophoneButton.tsx
```

Add the following code:

```typescript
'use client';

import React, { useState } from 'react';
import { IMicrophoneAudioTrack } from 'agora-rtc-react';
import { Mic, MicOff } from 'lucide-react'; // Import from lucide-react or another icon library

interface MicrophoneButtonProps {
  isEnabled: boolean;
  setIsEnabled: (enabled: boolean) => void;
  localMicrophoneTrack: IMicrophoneAudioTrack | null;
}

export function MicrophoneButton({
  isEnabled,
  setIsEnabled,
  localMicrophoneTrack,
}: MicrophoneButtonProps) {
  const toggleMicrophone = async () => {
    if (localMicrophoneTrack) {
      const newState = !isEnabled;
      try {
        await localMicrophoneTrack.setEnabled(newState);
        setIsEnabled(newState);
        console.log('Microphone state updated successfully');
      } catch (error) {
        console.error('Failed to toggle microphone:', error);
      }
    }
  };

  return (
    <button
      onClick={toggleMicrophone}
      className={`relative w-16 h-16 rounded-full shadow-lg flex items-center justify-center transition-colors ${
        isEnabled ? 'bg-white hover:bg-gray-50' : 'bg-red-500 hover:bg-red-600'
      }`}
      aria-label={isEnabled ? 'Mute microphone' : 'Unmute microphone'}
    >
      <div className={`relative z-10`}>
        {isEnabled ? (
          <Mic size={24} className="text-gray-800" />
        ) : (
          <MicOff size={24} className="text-white" />
        )}
      </div>
    </button>
  );
}
```

### Updating the Conversation Component

Now, let's update our conversation component to handle stopping and restarting the AI agent. We'll also add in the microphone button component:

```typescript
// Previous imports remain the same as before...
import { MicrophoneButton } from './MicrophoneButton'; // microphone button component
// import new ClientStartRequest and StopConversationRequest types
import type {
  ConversationComponentProps,
  ClientStartRequest,
  StopConversationRequest,
} from '../types/conversation';

export default function ConversationComponent({
  agoraLocalUserInfo,
  onTokenWillExpire,
  onEndConversation,
}: ConversationComponentProps) {
  // Previous state management code remains the same as before...
  // Add new agent related state variables
  const [isAgentConnected, setIsAgentConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const agentUID = process.env.NEXT_PUBLIC_AGENT_UID;

  // Join the channel hook remains the same as before...
  // Set UID on join success, remains the same as before...
  // Publish local microphone track remains the same as before...

  // Update remote user events - specifically looking for the AI agent
  useClientEvent(client, 'user-joined', (user) => {
    console.log('Remote user joined:', user.uid);
    if (user.uid.toString() === agentUID) {
      setIsAgentConnected(true);
      setIsConnecting(false);
    }
  });

  useClientEvent(client, 'user-left', (user) => {
    console.log('Remote user left:', user.uid);
    if (user.uid.toString() === agentUID) {
      setIsAgentConnected(false);
      setIsConnecting(false);
    }
  });

  // Sync isAgentConnected with remoteUsers
  useEffect(() => {
    const isAgentInRemoteUsers = remoteUsers.some(
      (user) => user.uid.toString() === agentUID
    );
    setIsAgentConnected(isAgentInRemoteUsers);
  }, [remoteUsers, agentUID]);

  // Connection state listener remains the same as before...
  // Cleanup on unmount remains the same as before...

  // Function to stop conversation with the AI agent
  const handleStopConversation = async () => {
    if (!isAgentConnected || !agoraLocalUserInfo.agentId) return;
    setIsConnecting(true);

    try {
      const stopRequest: StopConversationRequest = {
        agent_id: agoraLocalUserInfo.agentId,
      };

      const response = await fetch('/api/stop-conversation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(stopRequest),
      });

      if (!response.ok) {
        throw new Error(`Failed to stop conversation: ${response.statusText}`);
      }

      // Wait for the agent to actually leave before resetting state
      // The user-left event handler will handle setting isAgentConnected to false
    } catch (error) {
      if (error instanceof Error) {
        console.warn('Error stopping conversation:', error.message);
      }
      setIsConnecting(false);
    }
  };

  // Function to start conversation with the AI agent
  const handleStartConversation = async () => {
    if (!joinedUID) return;
    setIsConnecting(true);

    try {
      const startRequest: ClientStartRequest = {
        requester_id: joinedUID.toString(),
        channel_name: agoraLocalUserInfo.channel,
        input_modalities: ['text'],
        output_modalities: ['text', 'audio'],
      };

      const response = await fetch('/api/invite-agent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(startRequest),
      });

      if (!response.ok) {
        throw new Error(`Failed to start conversation: ${response.statusText}`);
      }

      // Update agent ID when new agent is connected
      const data = await response.json();
      if (data.agent_id) {
        agoraLocalUserInfo.agentId = data.agent_id;
      }
    } catch (error) {
      if (error instanceof Error) {
        console.warn('Error starting conversation:', error.message);
      }
      // Reset connecting state if there's an error
      setIsConnecting(false);
    }
  };

  // Token renewal handler remains the same as before...
  // Add token observer remains the same as before...

  // Updated return to include stop, restart, and microphone controls
  return (
    <div className="flex flex-col gap-6 p-4 h-full relative">
      {/* Connection Status */}
      <div className="absolute top-4 right-4 flex items-center gap-2">
        {isAgentConnected ? (
          <button
            onClick={handleStopConversation}
            disabled={isConnecting}
            className="px-4 py-2 bg-red-500/80 text-white rounded-full border border-red-400/30 backdrop-blur-sm 
            hover:bg-red-600/90 transition-all shadow-lg 
            disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
          >
            {isConnecting ? 'Disconnecting...' : 'Stop Agent'}
          </button>
        ) : (
          <button
            onClick={handleStartConversation}
            disabled={isConnecting}
            className="px-4 py-2 bg-yellow-500/80 text-white rounded-full border border-yellow-400/30 backdrop-blur-sm 
            hover:bg-yellow-600/90 transition-all shadow-lg 
            disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
          >
            {isConnecting ? 'Connecting...' : 'Connect Agent'}
          </button>
        )}
        <div
          className={`w-3 h-3 rounded-full ${
            isConnected ? 'bg-green-500' : 'bg-red-500'
          }`}
          onClick={onEndConversation}
          role="button"
          title="End conversation"
          style={{ cursor: 'pointer' }}
        />
      </div>

      {/* Remote Users Section */}
      <div className="flex-1">
        {remoteUsers.map((user) => (
          <div key={user.uid} className="mb-4">
            <p className="text-center text-sm text-gray-400 mb-2">
              {user.uid.toString() === agentUID
                ? 'AI Agent'
                : `User: ${user.uid}`}
            </p>
            <RemoteUser user={user} />
          </div>
        ))}

        {remoteUsers.length === 0 && (
          <div className="text-center text-gray-500 py-8">
            {isConnected
              ? 'Waiting for AI agent to join...'
              : 'Connecting to channel...'}
          </div>
        )}
      </div>

      {/* Microphone Control */}
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2">
        <MicrophoneButton
          isEnabled={isEnabled}
          setIsEnabled={setIsEnabled}
          localMicrophoneTrack={localMicrophoneTrack}
        />
      </div>
    </div>
  );
}
```

## Audio Visualization (Optional)

Let's add an audio visualization to give visual feedback to the user when the AI agent is speaking. Here's an example of an audio visualizer component, that takes the Agora audio track as input for the animation.

Create a file at `components/AudioVisualizer.tsx`:

```bash
touch components/AudioVisualizer.tsx
```

Add the following code:

```typescript
'use client';

import React, { useEffect, useRef, useState } from 'react';
import { ILocalAudioTrack, IRemoteAudioTrack } from 'agora-rtc-react';

interface AudioVisualizerProps {
  track: ILocalAudioTrack | IRemoteAudioTrack | undefined;
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({ track }) => {
  const [isVisualizing, setIsVisualizing] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number>();
  const barsRef = useRef<(HTMLDivElement | null)[]>([]);

  const animate = () => {
    if (!analyserRef.current) {
      return;
    }

    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyserRef.current.getByteFrequencyData(dataArray);

    // Define frequency ranges for different bars to create a more appealing visualization
    const frequencyRanges = [
      [24, 31], // Highest (bar 0, 8)
      [16, 23], // Mid-high (bar 1, 7)
      [8, 15], // Mid (bar 2, 6)
      [4, 7], // Low-mid (bar 3, 5)
      [0, 3], // Lowest (bar 4 - center)
    ];

    barsRef.current.forEach((bar, index) => {
      if (!bar) {
        return;
      }

      // Use symmetrical ranges for the 9 bars
      const rangeIndex = index < 5 ? index : 8 - index;
      const [start, end] = frequencyRanges[rangeIndex];

      // Calculate average energy in this frequency range
      let sum = 0;
      for (let i = start; i <= end; i++) {
        sum += dataArray[i];
      }
      let average = sum / (end - start + 1);

      // Apply different multipliers to create a more appealing shape
      const multipliers = [0.7, 0.8, 0.85, 0.9, 0.95];
      const multiplierIndex = index < 5 ? index : 8 - index;
      average *= multipliers[multiplierIndex];

      // Scale and limit the height
      const height = Math.min((average / 255) * 100, 100);
      bar.style.height = `${height}px`;
    });

    animationFrameRef.current = requestAnimationFrame(animate);
  };

  useEffect(() => {
    if (!track) {
      return;
    }

    const startVisualizer = async () => {
      try {
        audioContextRef.current = new AudioContext();
        analyserRef.current = audioContextRef.current.createAnalyser();
        analyserRef.current.fftSize = 64; // Keep this small for performance

        // Get the audio track from Agora
        const mediaStreamTrack = track.getMediaStreamTrack();
        const stream = new MediaStream([mediaStreamTrack]);

        // Connect it to our analyzer
        const source = audioContextRef.current.createMediaStreamSource(stream);
        source.connect(analyserRef.current);

        setIsVisualizing(true);
        animate();
      } catch (error) {
        console.error('Error starting visualizer:', error);
      }
    };

    startVisualizer();

    // Clean up when component unmounts or track changes
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, [track]);

  return (
    <div className="w-full h-40 rounded-lg overflow-hidden flex items-center justify-center relative">
      <div className="flex items-center space-x-2 h-[100px] relative z-10">
        {/* Create 9 bars for the visualizer */}
        {[...Array(9)].map((_, index) => (
          <div
            key={index}
            ref={(el) => {
              barsRef.current[index] = el;
            }}
            className="w-3 bg-gradient-to-t from-yellow-500 via-purple-500 to-pink-500 rounded-full transition-all duration-75"
            style={{
              height: '2px',
              minHeight: '2px',
              background: 'linear-gradient(to top, #3b82f6, #8b5cf6, #ec4899)',
            }}
          />
        ))}
      </div>
    </div>
  );
};
```

The visualizer works by:

1. Taking an audio track from the Agora SDK through the `track` prop

2. Extracting frequency data from the audio stream using the Web Audio API

3. Rendering visual bars that respond to different frequency ranges in the audio

To use this visualizer with the remote user's audio track, we need to update how we render the `RemoteUser` in the `ConversationComponent`:

```typescript
// Inside the remoteUsers.map in ConversationComponent.tsx:
{
  remoteUsers.map((user) => (
    <div key={user.uid} className="mb-4">
      {/* Add the audio visualizer for the remote user */}
      <AudioVisualizer track={user.audioTrack} />
      <p className="text-center text-sm text-gray-400 mb-2">
        {user.uid.toString() === agentUID ? 'AI Agent' : `User: ${user.uid}`}
      </p>
      <RemoteUser user={user} />
    </div>
  ));
}
```

### Integrating the Audio Visualizer

To integrate/wire-in the audio visualizer with our conversation component, we need to:

1. Import the AudioVisualizer component
2. Pass the appropriate audio track to it
3. Position it in our UI

Update your `ConversationComponent.tsx` to include the audio visualizer:

```typescript
'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  useRTCClient,
  useLocalMicrophoneTrack,
  useRemoteUsers,
  useClientEvent,
  useIsConnected,
  useJoin,
  usePublish,
  RemoteUser,
  UID,
} from 'agora-rtc-react';
import { MicrophoneButton } from './MicrophoneButton';
import { AudioVisualizer } from './AudioVisualizer';
import type {
  ConversationComponentProps,
  ClientStartRequest,
  StopConversationRequest,
} from '../types/conversation';

// Rest of the component as before...

// Then in the render method:
return (
  <div className="flex flex-col gap-6 p-4 h-full relative">
    {/* Connection Status */}
    {/* ... */}

    {/* Remote Users Section with Audio Visualizer */}
    <div className="flex-1">
      {remoteUsers.map((user) => (
        <div key={user.uid} className="mb-8 p-4 bg-gray-800/30 rounded-lg">
          <p className="text-center text-sm text-gray-400 mb-2">
            {user.uid.toString() === agentUID
              ? 'AI Agent'
              : `User: ${user.uid}`}
          </p>

          {/* The AudioVisualizer receives the remote user's audio track */}
          <AudioVisualizer track={user.audioTrack} />

          {/* The RemoteUser component handles playing the audio */}
          <RemoteUser user={user} />
        </div>
      ))}

      {remoteUsers.length === 0 && (
        <div className="text-center text-gray-500 py-8">
          {isConnected
            ? 'Waiting for AI agent to join...'
            : 'Connecting to channel...'}
        </div>
      )}
    </div>

    {/* Microphone Control */}
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2">
      <MicrophoneButton
        isEnabled={isEnabled}
        setIsEnabled={setIsEnabled}
        localMicrophoneTrack={localMicrophoneTrack}
      />
    </div>
  </div>
);
```

This creates a responsive visualization that makes it clear when the AI agent is speaking, which improves the user experience through visual feedback alongside the audio.

## Enhanced Microphone Button with Visualization

Since we only have a single user and an AI in the channel we should also update our microphone button to include its own audio visualization. This gives the user visual feedback that their mic is capturing audio input. Let's create a more sophisticated version of our `MicrophoneButton.tsx`:

```typescript
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRTCClient, IMicrophoneAudioTrack } from 'agora-rtc-react';
import { Mic, MicOff } from 'lucide-react';

// Interface for audio bar data
interface AudioBar {
  height: number;
}

interface MicrophoneButtonProps {
  isEnabled: boolean;
  setIsEnabled: (enabled: boolean) => void;
  localMicrophoneTrack: IMicrophoneAudioTrack | null;
}

export function MicrophoneButton({
  isEnabled,
  setIsEnabled,
  localMicrophoneTrack,
}: MicrophoneButtonProps) {
  // State to store audio visualization data
  const [audioData, setAudioData] = useState<AudioBar[]>(
    Array(5).fill({ height: 0 })
  );

  // Get the Agora client from context
  const client = useRTCClient();

  // References for audio processing
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number>();

  // Set up and clean up audio analyzer based on microphone state
  useEffect(() => {
    if (localMicrophoneTrack && isEnabled) {
      setupAudioAnalyser();
    } else {
      cleanupAudioAnalyser();
    }

    return () => cleanupAudioAnalyser();
  }, [localMicrophoneTrack, isEnabled]);

  // Initialize the audio analyzer
  const setupAudioAnalyser = async () => {
    if (!localMicrophoneTrack) return;

    try {
      // Create audio context and analyzer
      audioContextRef.current = new AudioContext();
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 64; // Small FFT size for better performance
      analyserRef.current.smoothingTimeConstant = 0.5; // Add smoothing

      // Get the microphone stream from Agora
      const mediaStream = localMicrophoneTrack.getMediaStreamTrack();
      const source = audioContextRef.current.createMediaStreamSource(
        new MediaStream([mediaStream])
      );

      // Connect the source to the analyzer
      source.connect(analyserRef.current);

      // Start updating the visualization
      updateAudioData();
    } catch (error) {
      console.error('Error setting up audio analyser:', error);
    }
  };

  // Clean up audio resources
  const cleanupAudioAnalyser = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    setAudioData(Array(5).fill({ height: 0 }));
  };

  // Update the audio visualization data
  const updateAudioData = () => {
    if (!analyserRef.current) return;

    // Get frequency data from analyzer
    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);

    // Split the frequency data into 5 segments
    const segmentSize = Math.floor(dataArray.length / 5);
    const newAudioData = Array(5)
      .fill(0)
      .map((_, index) => {
        // Get average value for this frequency segment
        const start = index * segmentSize;
        const end = start + segmentSize;
        const segment = dataArray.slice(start, end);
        const average = segment.reduce((a, b) => a + b, 0) / segment.length;

        // Scale and shape the response curve for better visualization
        const scaledHeight = Math.min(60, (average / 255) * 100 * 1.2);
        const height = Math.pow(scaledHeight / 60, 0.7) * 60;

        return {
          height: height,
        };
      });

    // Update state with new data
    setAudioData(newAudioData);

    // Schedule the next update
    animationFrameRef.current = requestAnimationFrame(updateAudioData);
  };

  // Toggle microphone state
  const toggleMicrophone = async () => {
    if (localMicrophoneTrack) {
      const newState = !isEnabled;
      try {
        // Enable/disable the microphone track
        await localMicrophoneTrack.setEnabled(newState);

        // Handle publishing/unpublishing
        if (!newState) {
          await client.unpublish(localMicrophoneTrack);
        } else {
          await client.publish(localMicrophoneTrack);
        }

        // Update state
        setIsEnabled(newState);
        console.log('Microphone state updated successfully');
      } catch (error) {
        console.error('Failed to toggle microphone:', error);
        // Revert to previous state on error
        localMicrophoneTrack.setEnabled(isEnabled);
      }
    }
  };

  return (
    <button
      onClick={toggleMicrophone}
      className={`relative w-16 h-16 rounded-full shadow-lg flex items-center justify-center transition-colors ${
        isEnabled ? 'bg-white hover:bg-gray-50' : 'bg-red-500 hover:bg-red-600'
      }`}
    >
      {/* Audio visualization bars */}
      <div className="absolute inset-0 flex items-center justify-center gap-1">
        {audioData.map((bar, index) => (
          <div
            key={index}
            className="w-1 rounded-full transition-all duration-100"
            style={{
              height: `${bar.height}%`,
              backgroundColor: isEnabled ? '#22c55e' : '#94a3b8',
              transform: `scaleY(${Math.max(0.1, bar.height / 100)})`,
              transformOrigin: 'center',
            }}
          />
        ))}
      </div>

      {/* Microphone icon overlaid on top */}
      <div className={`relative z-10`}>
        {isEnabled ? (
          <Mic size={24} className="text-gray-800" />
        ) : (
          <MicOff size={24} className="text-white" />
        )}
      </div>
    </button>
  );
}
```

The microphone button with audio visualization helps users understand:

- If their microphone is working properly
- When they're speaking loudly enough to be heard
- When background noise might be affecting their audio quality

The goal is to create a more intuitive and visually engaging experience for users.

## Testing

Now that we have all the components in place, let's finish by testing the application.

### Starting the Development Server

To start the development server:

```bash
npm run dev
```

> **Note:** Make sure your `.env` file is properly configured with all the necessary credentials. There is a complete list of environment variables at the end of this guide.

If your application is running correctly, you should see output like:

```
Server is running on port 3000
```

Open your browser to `http://localhost:3000` and test.

### Common Issues and Solutions

- **Agent not joining**:

  - Verify your Agora Conversational AI credentials
  - Check console for specific error messages
  - Ensure your TTS configuration is valid

- **Audio not working**:

  - Check browser permissions for microphone access
  - Verify the microphone is enabled in the app
  - Check if audio tracks are properly published

- **Token errors**:

  - Verify App ID and App Certificate are correct
  - Ensure token renewal logic is working
  - Check for proper error handling in token-related functions

- **Channel connection issues**:
  - Check network connectivity
  - Verify Agora service status
  - Ensure proper cleanup when leaving channels

## Customizations

Agora Conversational AI Engine supports a number of customizations.

### Customizing the Agent

In the `/agent/invite` endpoint, the `system_message` shapes how the AI agent responds, giving it a specific personality and communication style.

Modify the `system_message` to customize the agents prompt:

```typescript
// In app/api/invite-agent/route.ts
system_messages: [
  {
    role: 'system',
    content:
      'You are a friendly and helpful assistant named Alex. Your personality is warm, patient, and slightly humorous. When speaking, use a conversational tone with occasional casual expressions. Your responses should be concise but informative, aimed at making complex topics accessible to everyone. If you don't know something, admit it honestly rather than guessing. When appropriate, offer follow-up questions to help guide the conversation.',
  },
],
```

You can also update the greeting to control the initial message it speaks into the channel.

```typescript
llm {
    greeting_message: 'Hello! How can I assist you today?',
    failure_message: 'Please wait a moment.',
}
```

### Customizing the Voice

Choose the right voice for your application by exploring the voice libraries:

- For Microsoft Azure TTS: Visit the [Microsoft Azure TTS Voice Gallery](https://speech.microsoft.com/portal/voicegallery)
- For ElevenLabs: Explore the [ElevenLabs Voice Library](https://elevenlabs.io/voice-library)

### Fine-tuning Voice Activity Detection

Adjust VAD settings to optimize conversation flow:

```typescript
// In app/api/invite-agent/route.ts
vad: {
  silence_duration_ms: 600,      // How long to wait after silence to end turn (Increase for longer pauses before next turns)
  speech_duration_ms: 10000,     // Maximum duration for a single speech segment (force end of turn after this time)
  threshold: 0.6,                // Sensitivity to background noise (Higher values require louder speech to trigger)
  interrupt_duration_ms: 200,    // How quickly interruptions are detected
  prefix_padding_ms: 400,        // How much audio to capture before speech is detected
},
```

# Complete Environment Variables Reference

Here's a complete list of environment variables for your `.env` file:

```
# Agora Configuration
NEXT_PUBLIC_AGORA_APP_ID=
NEXT_PUBLIC_AGORA_APP_CERTIFICATE=
NEXT_PUBLIC_AGORA_CUSTOMER_ID=
NEXT_PUBLIC_AGORA_CUSTOMER_SECRET=

NEXT_PUBLIC_AGORA_CONVO_AI_BASE_URL=https://api.agora.io/api/conversational-ai-agent/v2/projects/
NEXT_PUBLIC_AGENT_UID=333

# LLM Configuration
NEXT_PUBLIC_LLM_URL=https://api.openai.com/v1/chat/completions
NEXT_PUBLIC_LLM_MODEL=gpt-4
NEXT_PUBLIC_LLM_API_KEY=
# TTS Configuration
NEXT_PUBLIC_TTS_VENDOR=microsoft

# Text-to-Speech Configuration
NEXT_PUBLIC_MICROSOFT_TTS_KEY=
NEXT_PUBLIC_MICROSOFT_TTS_REGION=eastus
NEXT_PUBLIC_MICROSOFT_TTS_VOICE_NAME=en-US-AndrewMultilingualNeural
NEXT_PUBLIC_MICROSOFT_TTS_RATE=1.1
NEXT_PUBLIC_MICROSOFT_TTS_VOLUME=70

# ElevenLabs Configuration
NEXT_PUBLIC_ELEVENLABS_API_KEY=
NEXT_PUBLIC_ELEVENLABS_VOICE_ID=XrExE9yKIg1WjnnlVkGX
NEXT_PUBLIC_ELEVENLABS_MODEL_ID=eleven_flash_v2_5

# Modalities Configuration
NEXT_PUBLIC_INPUT_MODALITIES=text
NEXT_PUBLIC_OUTPUT_MODALITIES=text,audio
```

## Next Steps

Congratulations! You've built an Express server that integrates with Agora's Conversational AI Engine. Take this microservice and integrateit with your existing Agora backends.

For more information about [Agora's Convesational AI Engine](https://www.agora.io/en/products/conversational-ai-engine/) check out the [official documenation](https://docs.agora.io/en/).

Happy building!
