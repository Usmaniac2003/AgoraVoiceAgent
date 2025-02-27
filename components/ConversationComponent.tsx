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
  StopConversationRequest,
  ClientStartRequest,
} from '../types/conversation';
import FloatingChat from './Floating-Chat';
import protoRoot from '@/protobuf/SttMessage_es6.js';

// Define the message type
export type StreamMessage = {
  uid: UID;
  content: string;
  timestamp: string;
  id: string;
  avatar?: string;
  sender?: 'user' | 'ai';
  isFinal?: boolean;
};

export default function ConversationComponent({
  agoraData,
  onTokenWillExpire,
  onEndConversation,
}: ConversationComponentProps) {
  const client = useRTCClient();
  const isConnected = useIsConnected();
  const remoteUsers = useRemoteUsers();
  const [isEnabled, setIsEnabled] = useState(true);
  const { localMicrophoneTrack } = useLocalMicrophoneTrack(isEnabled);
  const [isAgentConnected, setIsAgentConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const agentUID = process.env.NEXT_PUBLIC_AGENT_UID;
  const [joinedUID, setJoinedUID] = useState<UID>(0);
  const [messages, setMessages] = useState<StreamMessage[]>([]);

  // Join the channel using the useJoin hook
  const { isConnected: joinSuccess } = useJoin(
    {
      appid: process.env.NEXT_PUBLIC_AGORA_APP_ID!,
      channel: agoraData.channel,
      token: agoraData.token,
      uid: parseInt(agoraData.uid),
    },
    true
  );

  // Update actualUID when join is successful
  useEffect(() => {
    if (joinSuccess && client) {
      const uid = client.uid;
      setJoinedUID(uid as UID);
      console.log('Join successful, using UID:', uid);
    }
  }, [joinSuccess, client]);

  // Publish local microphone track
  usePublish([localMicrophoneTrack]);

  // Ensure local track is enabled for testing
  useEffect(() => {
    if (localMicrophoneTrack) {
      localMicrophoneTrack.setEnabled(true);
    }
  }, [localMicrophoneTrack]);

  // Handle remote user events
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

  // Connection state changes
  useClientEvent(client, 'connection-state-change', (curState, prevState) => {
    console.log(`Connection state changed from ${prevState} to ${curState}`);

    if (curState === 'DISCONNECTED') {
      console.log('Attempting to reconnect...');
    }
  });

  // Listen for the 'stream-message' event
  useClientEvent(client, 'stream-message', (remoteUser, data) => {
    try {
      console.log('Received stream message from UID:', remoteUser);

      // Try to decode with protobuf first
      try {
        const textMessage =
          protoRoot.Agora.SpeechToText.lookup('Text').decode(data);
        console.log('Decoded protobuf message:', textMessage);

        // Check if this is a final message
        const isFinal =
          textMessage.words &&
          textMessage.words.length > 0 &&
          textMessage.words[0].is_final;

        // Extract text from words array if available
        let messageContent = '';
        if (textMessage.words && textMessage.words.length > 0) {
          messageContent = textMessage.words
            .map((word: { text: string }) => word.text)
            .join(' ');
        } else {
          // Fallback to text decoder
          throw new Error('No words in protobuf message');
        }

        // Only add the message to the state if it's a final message
        if (isFinal) {
          const timestamp = new Date().toLocaleTimeString();
          const messageObj: StreamMessage = {
            uid: remoteUser,
            content: messageContent,
            timestamp,
            sender: remoteUser.toString() === agentUID ? 'ai' : 'user',
            isFinal,
            id: Date.now().toString(),
          };

          setMessages((prevMessages) => [...prevMessages, messageObj]);

          console.log('Processed final stream message:', {
            uid: remoteUser,
            content: messageContent,
            timestamp,
          });
        } else {
          console.log('Skipping non-final message:', messageContent);
        }
      } catch (protoError) {
        console.warn('Failed to decode with protobuf:', protoError);

        // Fallback to regular text decoding
        const decodedText = new TextDecoder().decode(data);

        // Parse the message format: ID|1|1|base64EncodedData
        const messageParts = decodedText.split('|');

        if (messageParts.length >= 4) {
          const messageId = messageParts[0];
          const base64Data = messageParts[3];

          try {
            // Decode the base64 data
            const jsonText = atob(base64Data);
            console.log(
              'Base64 decoded text:',
              jsonText.substring(0, 100) + '...'
            );

            try {
              const jsonData = JSON.parse(jsonText);
              console.log('Parsed JSON data:', jsonData);

              // Extract the text field and is_final flag
              if (jsonData.text) {
                // Determine sender based on user_id field
                let sender: 'user' | 'ai' = 'ai';

                // If user_id matches the joined UID, it's from the user
                if (
                  jsonData.user_id &&
                  jsonData.user_id === joinedUID.toString()
                ) {
                  sender = 'user';
                } else if (jsonData.user_id === '') {
                  // Empty user_id indicates AI message
                  sender = 'ai';
                }

                const messageObj: StreamMessage = {
                  uid: remoteUser,
                  content: jsonData.text,
                  timestamp: new Date().toLocaleTimeString(),
                  sender,
                  isFinal: jsonData.is_final || false,
                  id: messageId,
                };

                // Update messages state based on message ID
                setMessages((prevMessages) => {
                  // Check if we already have a message with this ID
                  const existingIndex = prevMessages.findIndex(
                    (msg) => msg.id === messageId
                  );

                  if (existingIndex >= 0) {
                    // Update existing message
                    const updatedMessages = [...prevMessages];
                    updatedMessages[existingIndex] = {
                      ...updatedMessages[existingIndex],
                      content: messageObj.content,
                      isFinal: messageObj.isFinal,
                    };
                    return updatedMessages;
                  } else {
                    // Add new message
                    return [
                      ...prevMessages,
                      {
                        ...messageObj,
                        id: messageId,
                      },
                    ];
                  }
                });
              }
            } catch (jsonError) {
              console.error('JSON parse error:', jsonError);
              console.log('Problematic JSON string:', jsonText);

              // Handle split messages - this is likely part of a previous message
              // Try to extract text content directly
              const textMatch = jsonText.match(/text": "([^"]+)/);
              if (textMatch && textMatch[1]) {
                const partialText = textMatch[1];

                // Add as a new message or append to the last message
                setMessages((prevMessages) => {
                  if (
                    prevMessages.length > 0 &&
                    !prevMessages[prevMessages.length - 1].isFinal
                  ) {
                    // Append to the last message
                    const updatedMessages = [...prevMessages];
                    const lastIndex = updatedMessages.length - 1;
                    updatedMessages[lastIndex] = {
                      ...updatedMessages[lastIndex],
                      content: updatedMessages[lastIndex].content + partialText,
                    };
                    return updatedMessages;
                  } else {
                    // Create a new message
                    return [
                      ...prevMessages,
                      {
                        id: Date.now().toString(),
                        uid: remoteUser,
                        content: partialText,
                        timestamp: new Date().toLocaleTimeString(),
                        sender:
                          remoteUser.toString() === agentUID ? 'ai' : 'user',
                        isFinal: false,
                      },
                    ];
                  }
                });
              }
            }
          } catch (base64Error) {
            console.error('Base64 decode error:', base64Error);
          }
        } else {
          // Not in the expected format, use as raw text
          const messageObj: StreamMessage = {
            uid: remoteUser,
            content: decodedText,
            timestamp: new Date().toLocaleTimeString(),
            id: Date.now().toString(),
            sender: remoteUser.toString() === agentUID ? 'ai' : 'user',
            isFinal: true,
          };

          setMessages((prevMessages) => [...prevMessages, messageObj]);
        }
      }
    } catch (error) {
      console.error('Error processing stream message:', error);
    }
  });

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      client?.leave();
    };
  }, [client]);

  const handleStopConversation = async () => {
    if (!isAgentConnected || !agoraData.agentId) return;
    setIsConnecting(true);

    try {
      const stopRequest: StopConversationRequest = {
        agent_id: agoraData.agentId,
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

  const handleStartConversation = async () => {
    if (!agoraData.agentId) return;
    setIsConnecting(true);

    try {
      const startRequest: ClientStartRequest = {
        requester_id: joinedUID?.toString(),
        channel_name: agoraData.channel,
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
        agoraData.agentId = data.agent_id;
      }
    } catch (error) {
      if (error instanceof Error) {
        console.warn('Error starting conversation:', error.message);
      }
      // Reset connecting state if there's an error
      setIsConnecting(false);
    }
  };

  // Add token renewal handler
  const handleTokenWillExpire = useCallback(async () => {
    if (!onTokenWillExpire || !joinedUID) return;
    try {
      const newToken = await onTokenWillExpire(joinedUID.toString());
      await client?.renewToken(newToken);
      console.log('Successfully renewed Agora token');
    } catch (error) {
      console.error('Failed to renew Agora token:', error);
    }
  }, [client, onTokenWillExpire, joinedUID]);

  // Add token observer
  useClientEvent(client, 'token-privilege-will-expire', handleTokenWillExpire);

  return (
    <div className="flex flex-col gap-6 p-4 h-full">
      {/* Connection Status - Updated to show connecting state */}
      <div className="absolute top-4 right-4 flex items-center gap-2">
        {isAgentConnected ? (
          <button
            onClick={handleStopConversation}
            disabled={isConnecting}
            className="px-4 py-2 bg-red-500/80 text-white rounded-full border border-red-400/30 backdrop-blur-sm 
            hover:bg-red-600/90 transition-all shadow-lg hover:shadow-red-500/20 
            disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
          >
            {isConnecting ? 'Disconnecting...' : 'Stop Agent'}
          </button>
        ) : (
          remoteUsers.length === 0 && (
            <button
              onClick={handleStartConversation}
              disabled={isConnecting}
              className="px-4 py-2 bg-blue-500/80 text-white rounded-full border border-blue-400/30 backdrop-blur-sm 
              hover:bg-blue-600/90 transition-all shadow-lg hover:shadow-blue-500/20 
              disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
            >
              {isConnecting ? 'Connecting with agent...' : 'Connect Agent'}
            </button>
          )
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

      {/* Remote Users Section - Moved to top */}
      <div className="flex-1">
        {remoteUsers.map((user) => (
          <div key={user.uid}>
            <AudioVisualizer track={user.audioTrack} />
            <RemoteUser user={user} />
          </div>
        ))}

        {remoteUsers.length === 0 && (
          <div className="text-center text-gray-500 py-8">
            Waiting for AI agent to join...
          </div>
        )}
      </div>

      {/* Local Controls - Fixed at bottom center */}
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2">
        <MicrophoneButton
          isEnabled={isEnabled}
          setIsEnabled={setIsEnabled}
          localMicrophoneTrack={localMicrophoneTrack}
        />
      </div>

      {/* Add the FloatingChat component */}
      <FloatingChat streamMessages={messages} agentUID={agentUID} />
    </div>
  );
}
