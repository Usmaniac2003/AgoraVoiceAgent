'use client';

import { useState, useEffect, useRef } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
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
  const [isOpen, setIsOpen] = useState(true);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastMessageRef = useRef<HTMLDivElement>(null);
  const prevMessageLengthRef = useRef(messageList.length);
  const [isChatExpanded, setIsChatExpanded] = useState(false);

  const handleScroll = () => {
    if (scrollRef.current) {
      const { scrollHeight, scrollTop, clientHeight } = scrollRef.current;
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 100;
      setShouldAutoScroll(isAtBottom);
    }
  };

  useEffect(() => {
    // Auto-scroll if new message arrived or if we should auto-scroll during streaming
    const hasNewMessage = messageList.length > prevMessageLengthRef.current;
    if (
      (hasNewMessage || shouldAutoScroll) &&
      scrollRef.current &&
      lastMessageRef.current
    ) {
      lastMessageRef.current.scrollIntoView({ behavior: 'smooth' });
    }
    prevMessageLengthRef.current = messageList.length;
  }, [messageList, currentInProgressMessage?.text, shouldAutoScroll]);

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
            <h3 className="font-semibold">Chat</h3>
            <Button variant="ghost" size="icon" onClick={toggleChatExpanded}>
              {isChatExpanded ? (
                <ArrowDownFromLine className="h-4 w-4" />
              ) : (
                <UnfoldVertical className="h-4 w-4" />
              )}
            </Button>
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
                    'flex flex-col',
                    message.uid === 0 || message.uid.toString() === agentUID
                      ? 'items-start'
                      : 'items-end'
                  )}
                >
                  <div
                    className={cn(
                      'rounded-lg px-3 py-2 max-w-[80%]',
                      message.uid === 0 || message.uid.toString() === agentUID
                        ? 'bg-gray-100'
                        : 'bg-blue-500 text-white',
                      message.status === EMessageStatus.IN_PROGRESS &&
                        'animate-pulse'
                    )}
                  >
                    {message.text}
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
