'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { MessageCircle, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { StreamMessage } from './ConversationComponent';
import useStreamingMessageProcessor, {
  Message,
} from './StreamingMessageProcessor';

interface FloatingChatProps {
  streamMessages: StreamMessage[];
  interimMessage?: StreamMessage | null;
  agentUID: string | undefined;
}

export default function FloatingChat({
  streamMessages,
  interimMessage = null,
  agentUID,
}: FloatingChatProps) {
  // State for managing chat window visibility and message history
  const [isOpen, setIsOpen] = useState(true);
  const [chatHistory, setChatHistory] = useState<Message[]>([]);

  // Ref for handling scroll behavior
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const processedMessagesRef = useRef(new Set<string>());

  // Callback to open chat window when new messages arrive
  const handleNewMessage = useCallback(() => {
    if (!isOpen) {
      setIsOpen(true);
    }
  }, [isOpen]);

  // Process incoming messages using the streaming processor hook
  const { messages, currentStreamingMessage } = useStreamingMessageProcessor({
    streamMessages,
    interimMessage,
    onNewMessage: handleNewMessage,
    agentUID,
  });

  // Update chat history when new messages are finalized
  useEffect(() => {
    if (messages.length === 0) return;

    // For debugging
    // console.log('Processing messages:', messages);

    // Update chat history with only finalized messages
    setChatHistory(messages.filter((msg) => msg.isFinal));
  }, [messages]);

  // Determine whether to show the streaming message
  const shouldShowStreamingMessage = useCallback(() => {
    if (!currentStreamingMessage) return false;

    // Check for duplicate content to prevent showing the same message twice
    // This handles various cases where messages might overlap or be contained within each other
    const isDuplicate = chatHistory.some(
      (msg) =>
        // Check if content is the same (exact match)
        msg.content === currentStreamingMessage.content ||
        // Or if the streaming content is contained within a final message
        // (handles cases where the final message might have additional formatting)
        msg.content.includes(currentStreamingMessage.content) ||
        // Or if the streaming message contains the final message content
        // (handles cases where the streaming message is more complete)
        currentStreamingMessage.content.includes(msg.content)
    );

    return !isDuplicate;
  }, [chatHistory, currentStreamingMessage]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollElement = scrollAreaRef.current.querySelector(
        '[data-radix-scroll-area-viewport]'
      );
      if (scrollElement) {
        scrollElement.scrollTop = scrollElement.scrollHeight;
      }
    }
  }, [chatHistory, currentStreamingMessage]);

  // Format timestamp to a readable time
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Toggle chat open/closed
  const toggleChat = () => {
    setIsOpen(!isOpen);
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {/* Chat Button - Toggle button for chat window visibility */}
      <Button
        onClick={toggleChat}
        className={cn(
          'h-14 w-14 rounded-full shadow-lg transition-all duration-300 flex items-center justify-center bg-white',
          isOpen ? 'scale-0 opacity-0' : 'scale-100 opacity-100'
        )}
        size="icon"
      >
        <MessageCircle className="h-6 w-6 text-black" />
      </Button>

      {/* Main chat window container with animation states */}
      <div
        className={cn(
          'bg-white rounded-lg border shadow-lg transition-all duration-300 overflow-hidden',
          isOpen
            ? 'opacity-100 scale-100 w-[350px] sm:w-[400px] h-[500px]'
            : 'opacity-0 scale-0 w-0 h-0'
        )}
      >
        <div className="p-3 border-b flex items-center justify-between bg-white text-black">
          <h2 className="text-lg font-semibold">Conversation Transcript</h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleChat}
            className="h-8 w-8"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </Button>
        </div>

        <ScrollArea
          className="h-[calc(500px-64px)] p-4 bg-white"
          ref={scrollAreaRef}
        >
          <div className="space-y-4">
            {/* Show empty state when no messages exist */}
            {chatHistory.length === 0 && !currentStreamingMessage ? (
              <div className="text-center text-gray-500 py-8">
                No messages yet. Start speaking to see the transcript.
              </div>
            ) : (
              <>
                {/* Render finalized messages */}
                {chatHistory.map((message) => (
                  <div
                    key={message.id}
                    className={`flex items-start gap-3 ${
                      message.sender === 'user' ? 'flex-row-reverse' : ''
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                        message.sender === 'user'
                          ? 'bg-gray-200'
                          : 'bg-blue-500'
                      }`}
                    >
                      <span
                        className={`text-sm ${
                          message.sender === 'user'
                            ? 'text-gray-600'
                            : 'text-white'
                        }`}
                      >
                        {message.sender === 'user' ? 'U' : 'AI'}
                      </span>
                    </div>

                    <div
                      className={`flex flex-col ${
                        message.sender === 'user' ? 'items-end' : 'items-start'
                      }`}
                    >
                      <div
                        className={`px-4 py-2 rounded-lg max-w-[80%] ${
                          message.sender === 'user'
                            ? 'bg-gray-200 text-black rounded-tr-none'
                            : 'bg-blue-500 text-white rounded-tl-none'
                        }`}
                      >
                        <p className="text-sm">{message.content}</p>
                      </div>
                      <span className="text-xs text-muted-foreground mt-1">
                        {formatTime(message.timestamp)}
                      </span>
                    </div>
                  </div>
                ))}

                {/* Render currently streaming message with typing indicator */}
                {currentStreamingMessage && shouldShowStreamingMessage() && (
                  <div
                    key={`streaming-${currentStreamingMessage.id}`}
                    className={`flex items-start gap-3 ${
                      currentStreamingMessage.sender === 'user'
                        ? 'flex-row-reverse'
                        : ''
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                        currentStreamingMessage.sender === 'user'
                          ? 'bg-gray-200'
                          : 'bg-blue-500'
                      }`}
                    >
                      <span
                        className={`text-sm ${
                          currentStreamingMessage.sender === 'user'
                            ? 'text-gray-600'
                            : 'text-white'
                        }`}
                      >
                        {currentStreamingMessage.sender === 'user' ? 'U' : 'AI'}
                      </span>
                    </div>

                    <div
                      className={`flex flex-col ${
                        currentStreamingMessage.sender === 'user'
                          ? 'items-end'
                          : 'items-start'
                      }`}
                    >
                      <div
                        className={`px-4 py-2 rounded-lg max-w-[80%] ${
                          currentStreamingMessage.sender === 'user'
                            ? 'bg-gray-200 text-black rounded-tr-none'
                            : 'bg-blue-500 text-white rounded-tl-none'
                        } border-l-4 border-blue-500`}
                      >
                        <p className="text-sm">
                          {currentStreamingMessage.content}
                        </p>
                      </div>
                      <span className="text-xs text-muted-foreground mt-1">
                        {formatTime(currentStreamingMessage.timestamp)}{' '}
                        (typing...)
                      </span>
                    </div>
                  </div>
                )}

                {/* Debugging info - can be removed in production */}
                <div className="mt-4 pt-2 border-t text-xs text-gray-500">
                  <p>Total messages: {chatHistory.length}</p>
                  <p>Streaming: {currentStreamingMessage ? 'Yes' : 'No'}</p>
                </div>
              </>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
