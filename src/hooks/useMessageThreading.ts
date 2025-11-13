import { useMemo } from "react";
import type { Message } from "@/pages/Dashboard";

export interface ThreadedMessage {
  threadId: string;
  messages: Message[];
  latestMessage: Message;
  count: number;
}

export const useMessageThreading = (
  messages: Message[],
  enabled: boolean
): ThreadedMessage[] => {
  return useMemo(() => {
    if (!enabled) {
      return messages.map(msg => ({
        threadId: msg.id,
        messages: [msg],
        latestMessage: msg,
        count: 1
      }));
    }

    const threads = new Map<string, Message[]>();
    
    messages.forEach(msg => {
      const threadId = msg.threadId || msg.id;
      if (!threads.has(threadId)) {
        threads.set(threadId, []);
      }
      threads.get(threadId)!.push(msg);
    });
    
    // Sort messages within each thread by date (newest first)
    threads.forEach(thread => {
      thread.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    });
    
    // Convert to array and sort threads by latest message date
    return Array.from(threads.entries())
      .map(([threadId, messages]) => ({
        threadId,
        messages,
        latestMessage: messages[0],
        count: messages.length
      }))
      .sort((a, b) => 
        new Date(b.latestMessage.date).getTime() - new Date(a.latestMessage.date).getTime()
      );
  }, [messages, enabled]);
};
