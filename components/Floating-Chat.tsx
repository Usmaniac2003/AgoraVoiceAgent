'use client';

import { useState, useEffect, useRef } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { MessageCircle, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { IMessageListItem, EMessageStatus } from '@/lib/message';

interface FloatingChatProps {
  messageList: IMessageListItem[];
  currentInProgressMessage?: IMessageListItem | null;
  agentUID: string | undefined;
}

export default function FloatingChat({
  messageList,
  currentInProgressMessage = null,
  agentUID,
}: FloatingChatProps) {
  // State for managing chat window visibility
  const [isOpen, setIsOpen] = useState(true);

  // Ref for handling scroll behavior
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Auto-scroll when new messages arrive
  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messageList, currentInProgressMessage]);

  const shouldShowStreamingMessage = () => {
    return (
      currentInProgressMessage !== null &&
      currentInProgressMessage.status === EMessageStatus.IN_PROGRESS
    );
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Toggle chat open/closed
  const toggleChat = () => {
    setIsOpen(!isOpen);
  };

  return (
    <div className="fixed bottom-24 right-8 z-50">
      {isOpen ? (
        <div className="bg-white rounded-lg shadow-lg w-96 max-h-[600px] flex flex-col">
          <div className="p-4 border-b flex justify-between items-center">
            <h3 className="font-semibold">Chat</h3>
            <Button variant="ghost" size="icon" onClick={toggleChat}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <ScrollArea ref={scrollAreaRef} className="flex-1 p-4">
            <div className="space-y-4">
              {messageList.map((message) => (
                <div
                  key={`${message.turn_id}-${message.uid}`}
                  className={cn(
                    'flex flex-col',
                    message.uid.toString() === agentUID
                      ? 'items-start'
                      : 'items-end'
                  )}
                >
                  <div
                    className={cn(
                      'rounded-lg px-3 py-2 max-w-[80%]',
                      message.uid.toString() === agentUID
                        ? 'bg-gray-100'
                        : 'bg-blue-500 text-white'
                    )}
                  >
                    {message.text}
                  </div>
                </div>
              ))}

              {shouldShowStreamingMessage() && currentInProgressMessage && (
                <div
                  className={cn(
                    'flex flex-col',
                    currentInProgressMessage.uid.toString() === agentUID
                      ? 'items-start'
                      : 'items-end'
                  )}
                >
                  <div
                    className={cn(
                      'rounded-lg px-3 py-2 max-w-[80%]',
                      currentInProgressMessage.uid.toString() === agentUID
                        ? 'bg-gray-100'
                        : 'bg-blue-500 text-white'
                    )}
                  >
                    {currentInProgressMessage.text}
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      ) : (
        <Button
          onClick={toggleChat}
          className="rounded-full w-12 h-12 flex items-center justify-center"
        >
          <MessageCircle className="h-6 w-6" />
        </Button>
      )}
    </div>
  );
}
