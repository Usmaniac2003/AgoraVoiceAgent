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

export default function useStreamingMessageProcessor({
  streamMessages,
  interimMessage = null,
  onNewMessage,
  agentUID,
}: StreamingMessageProcessorProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentStreamingMessage, setCurrentStreamingMessage] =
    useState<Message | null>(null);
  const processedMessagesRef = useRef(new Set<string>());
  const finalizedContentRef = useRef(new Set<string>());

  // Process incoming stream messages
  useEffect(() => {
    // Only process if there are messages or if the length has changed
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

      // If it's a final message, add to history and track its content
      if (message.isFinal) {
        newMessages.push(message);
        hasNewMessage = true;
        finalizedContentRef.current.add(message.content);
      } else {
        // If it's not final, check if its content matches any finalized content
        const isContentAlreadyFinalized = finalizedContentRef.current.has(
          message.content
        );

        // Only update the streaming message if it's not already finalized
        if (!isContentAlreadyFinalized) {
          setCurrentStreamingMessage(message);
        }
      }
    });

    // Update messages state if we have new ones
    if (newMessages.length > 0) {
      setMessages((prev) => [...prev, ...newMessages]);

      // Clear the current streaming message if it became final
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

  // Handle interim message (if provided)
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
