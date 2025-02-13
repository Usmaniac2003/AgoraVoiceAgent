# Conversational AI: NextJS Client

A Next.js-based web-app for conversational AI agents, built with Agora's Real-Time Communication SDK.

<img src="./.github/assets/Conversation-Ai-Client.gif" alt="Conversational AI Client" />

## Prerequisites

Before you begin, ensure you have the following installed:

- [Node.js](https://nodejs.org/) (version 16.x or higher)
- [pnpm](https://pnpm.io/) (version 8.x or higher)

You must have an Agora account and a project to use this application.

- [Agora Account](https://console.agora.io/)

## Installation

1. Clone the repository:

```bash
git clone https://github.com/AgoraIO-Community/conversational-ai-nextjs-client
cd conversational-ai-nextjs-client
```

2. Install dependencies:

```bash
pnpm install
```

3. Create a `.env.local` file in the root directory and add your environment variables:

```bash
cp .env.local.example .env.local
```

The following environment variables are required:

### Agora Configuration

- `NEXT_PUBLIC_AGORA_APP_ID` - Your Agora App ID
- `NEXT_PUBLIC_AGORA_APP_CERTIFICATE` - Your Agora App Certificate
- `NEXT_PUBLIC_AGORA_CONVO_AI_BASE_URL` - Agora Conversation AI Base URL
- `NEXT_PUBLIC_AGORA_CUSTOMER_ID` - Your Agora Customer ID
- `NEXT_PUBLIC_AGORA_CUSTOMER_SECRET` - Your Agora Customer Secret
- `NEXT_PUBLIC_AGENT_UID` - Agent UID (defaults to "Agent")

### LLM Configuration

- `NEXT_PUBLIC_LLM_URL` - LLM API endpoint URL
- `NEXT_PUBLIC_LLM_TOKEN` - LLM API authentication token
- `NEXT_PUBLIC_LLM_MODEL` - LLM model to use (optional)

### TTS Configuration

Choose one of the following TTS providers:

#### Microsoft TTS

- `NEXT_PUBLIC_TTS_VENDOR=microsoft`
- `NEXT_PUBLIC_MICROSOFT_TTS_KEY` - Microsoft TTS API key
- `NEXT_PUBLIC_MICROSOFT_TTS_REGION` - Microsoft TTS region
- `NEXT_PUBLIC_MICROSOFT_TTS_VOICE_NAME` - Voice name (optional, defaults to 'en-US-AndrewMultilingualNeural')
- `NEXT_PUBLIC_MICROSOFT_TTS_RATE` - Speech rate (optional, defaults to 1.0)
- `NEXT_PUBLIC_MICROSOFT_TTS_VOLUME` - Volume (optional, defaults to 100.0)

#### ElevenLabs

- `NEXT_PUBLIC_TTS_VENDOR=elevenlabs`
- `NEXT_PUBLIC_ELEVENLABS_API_KEY` - ElevenLabs API key
- `NEXT_PUBLIC_ELEVENLABS_VOICE_ID` - ElevenLabs voice ID
- `NEXT_PUBLIC_ELEVENLABS_MODEL_ID` - Model ID (optional, defaults to 'eleven_flash_v2_5')

### Modalities Configuration

- `NEXT_PUBLIC_INPUT_MODALITIES` - Comma-separated list of input modalities (defaults to 'text')
- `NEXT_PUBLIC_OUTPUT_MODALITIES` - Comma-separated list of output modalities (defaults to 'text,audio')

4. Run the development server:

```bash
pnpm dev
```

4. Open your browser and navigate to `http://localhost:3000` to see the application in action.

## Voice Options

### Microsoft TTS

Male voices:

- en-US-AndrewMultilingualNeural (default)
- en-US-ChristopherNeural (casual, friendly)
- en-US-GuyNeural (professional)
- en-US-JasonNeural (clear, energetic)
- en-US-TonyNeural (enthusiastic)

Female voices:

- en-US-JennyNeural (assistant-like)
- en-US-AriaNeural (professional)
- en-US-EmmaNeural (friendly)
- en-US-SaraNeural (warm)

Try voices: https://speech.microsoft.com/portal/voicegallery

### ElevenLabs

Try voices: https://elevenlabs.io/app/voice-lab

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## API Endpoints

The application provides the following API endpoints:

### Generate Agora Token

- **Endpoint**: `/api/generate-agora-token`
- **Method**: GET
- **Query Parameters**:
  - `uid` (optional) - User ID (defaults to 0)
  - `channel` (optional) - Channel name (auto-generated if not provided)
- **Response**: Returns token, uid, and channel information

### Invite Agent

- **Endpoint**: `/api/invite-agent`
- **Method**: POST
- **Body**:

```typescript
{
  requester_id: string;
  channel_name: string;
  input_modalities?: string[];
  output_modalities?: string[];
}
```

### Stop Conversation

- **Endpoint**: `/api/stop-conversation`
- **Method**: POST
- **Body**:

```typescript
{
  agent_id: string;
}
```
