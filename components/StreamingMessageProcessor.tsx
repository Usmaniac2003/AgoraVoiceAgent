'use client';

import { useState, useEffect, useRef } from 'react';
import { StreamMessage } from './ConversationComponent';

// Define the message type
export type Message = {
  id: string;
  content: string;
  sender: 'user' | 'ai';
  timestamp: Date;
  avatar?: string;
  isFinal: boolean;
};

interface StreamingMessageProcessorProps {
  streamMessages: StreamMessage[];
  interimMessage?: StreamMessage | null;
  onNewMessage?: () => void;
  agentUID: string | undefined;
}

// Custom hook for processing streaming messages and managing message state
export default function useStreamingMessageProcessor({
  streamMessages,
  interimMessage = null,
  onNewMessage,
  agentUID,
}: StreamingMessageProcessorProps) {
  // State to store finalized messages and currently streaming message
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentStreamingMessage, setCurrentStreamingMessage] =
    useState<Message | null>(null);

  // Refs to track processed messages and finalized content across renders
  const processedMessagesRef = useRef(new Set<string>()); // Tracks message IDs that have been processed
  const finalizedContentRef = useRef(new Set<string>()); // Tracks message content that has been finalized

  // Process incoming stream messages whenever they change
  useEffect(() => {
    // Skip processing if no new messages to handle
    if (
      streamMessages.length === 0 ||
      (streamMessages.length === processedMessagesRef.current.size &&
        !interimMessage)
    ) {
      return;
    }

    // Process stream messages
    const newMessages: Message[] = [];
    let hasNewMessage = false;

    streamMessages.forEach((msg) => {
      // Skip already processed messages
      if (processedMessagesRef.current.has(msg.id)) return;

      // Mark as processed
      processedMessagesRef.current.add(msg.id);

      // Convert to our internal message format
      const message: Message = {
        id: msg.id,
        content: msg.content,
        timestamp: new Date(msg.timestamp || Date.now()),
        sender: msg.sender || (msg.uid.toString() === agentUID ? 'ai' : 'user'),
        isFinal: msg.isFinal || false,
        avatar: msg.avatar || '',
      };

      // If message is marked as final, add to history and mark content as finalized
      if (message.isFinal) {
        newMessages.push(message);
        hasNewMessage = true;
        finalizedContentRef.current.add(message.content);
      } else {
        // For non-final messages, check if we've already finalized this content
        // This prevents showing duplicate content in different states
        const isContentAlreadyFinalized = finalizedContentRef.current.has(
          message.content
        );

        if (!isContentAlreadyFinalized) {
          setCurrentStreamingMessage(message);
        }
      }
    });

    // Update the message history with new finalized messages
    if (newMessages.length > 0) {
      setMessages((prev) => [...prev, ...newMessages]);

      // Clear streaming message if it became final or its content was finalized
      if (
        currentStreamingMessage &&
        (newMessages.some((msg) => msg.id === currentStreamingMessage.id) ||
          finalizedContentRef.current.has(currentStreamingMessage.content))
      ) {
        setCurrentStreamingMessage(null);
      }
    }

    // Notify parent component of new messages
    if (hasNewMessage && onNewMessage) {
      onNewMessage();
    }
  }, [streamMessages, onNewMessage, agentUID, currentStreamingMessage]);

  // Handle interim message updates (typically used for real-time typing indicators)
  useEffect(() => {
    if (!interimMessage) {
      return;
    }

    const message: Message = {
      id: interimMessage.id,
      content: interimMessage.content,
      timestamp: new Date(interimMessage.timestamp || Date.now()),
      sender:
        interimMessage.sender ||
        (interimMessage.uid.toString() === agentUID ? 'ai' : 'user'),
      isFinal: false,
      avatar: interimMessage.avatar || '',
    };

    // Only set the streaming message if its content isn't already finalized
    if (!finalizedContentRef.current.has(message.content)) {
      setCurrentStreamingMessage(message);
    }
  }, [interimMessage, agentUID]);

  return { messages, currentStreamingMessage };
}
