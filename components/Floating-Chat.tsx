'use client';

import { useState, useEffect, useRef } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { MessageCircle, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { StreamMessage } from './ConversationComponent';

// Define the message type
type Message = {
  id: string;
  content: string;
  sender: 'user' | 'ai';
  timestamp: Date;
  avatar?: string;
};

type FloatingChatProps = {
  streamMessages?: StreamMessage[];
  agentUID?: string;
};

export default function FloatingChat({
  streamMessages = [],
  agentUID,
}: FloatingChatProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Update messages when streamMessages changes
  useEffect(() => {
    if (streamMessages.length > 0) {
      try {
        // Get the latest stream message
        const latestStreamMessage = streamMessages[streamMessages.length - 1];

        // Try to parse the content as JSON in case it's a protobuf-decoded message
        let messageContent = latestStreamMessage.content;
        try {
          const parsedContent = JSON.parse(latestStreamMessage.content);
          // If it's a protobuf message with a text field, use that
          if (parsedContent.words && Array.isArray(parsedContent.words)) {
            messageContent = parsedContent.words
              .map((word: { text: string }) => word.text)
              .join(' ');
          } else if (parsedContent.text) {
            messageContent = parsedContent.text;
          }
        } catch (e) {
          // Not JSON, use the raw content
          console.log('Using raw message content');
        }

        // Only add if it's not empty and not a duplicate
        if (messageContent && messageContent.trim() !== '') {
          const isDuplicate = messages.some(
            (msg) => msg.content === messageContent
          );

          if (!isDuplicate) {
            const newMessage: Message = {
              id: Date.now().toString(),
              content: messageContent,
              // Determine if the message is from the AI agent or the user
              sender:
                latestStreamMessage.uid.toString() === agentUID ? 'ai' : 'user',
              timestamp: new Date(),
              avatar: '/placeholder.svg?height=40&width=40',
            };

            setMessages((prevMessages) => [...prevMessages, newMessage]);

            // Auto-open the chat when a new message arrives
            if (!isOpen) {
              setIsOpen(true);
            }
          }
        }
      } catch (error) {
        console.error('Error processing stream message:', error);
      }
    }
  }, [streamMessages, agentUID, isOpen, messages]);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollElement = scrollAreaRef.current.querySelector(
        '[data-radix-scroll-area-viewport]'
      );
      if (scrollElement) {
        scrollElement.scrollTop = scrollElement.scrollHeight;
      }
    }
  }, [messages]);

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
      {/* Chat Button */}
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

      {/* Chat Window */}
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
            {messages.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                No messages yet. Start speaking to see the transcript.
              </div>
            ) : (
              messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex items-start gap-3 ${
                    message.sender === 'user' ? 'flex-row-reverse' : ''
                  }`}
                >
                  <Avatar className="mt-0.5 flex-shrink-0">
                    <AvatarImage
                      src={message.avatar}
                      alt={message.sender === 'user' ? 'User' : 'AI'}
                    />
                    <AvatarFallback>
                      {message.sender === 'user' ? 'U' : 'AI'}
                    </AvatarFallback>
                  </Avatar>

                  <div
                    className={`flex flex-col ${
                      message.sender === 'user' ? 'items-end' : 'items-start'
                    }`}
                  >
                    <div
                      className={`px-4 py-2 rounded-lg max-w-[80%] ${
                        message.sender === 'user'
                          ? 'bg-primary text-primary-foreground rounded-tr-none'
                          : 'bg-muted text-black rounded-tl-none'
                      }`}
                    >
                      <p className="text-sm">{message.content}</p>
                    </div>
                    <span className="text-xs text-muted-foreground mt-1">
                      {formatTime(message.timestamp)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
