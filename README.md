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
