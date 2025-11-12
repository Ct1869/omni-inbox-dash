import { useState, useEffect } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Star, Paperclip, Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Account, Message } from "@/pages/Dashboard";

// Mock data generator
const generateMockMessages = (accountId: string): Message[] => {
  const subjects = [
    "Q4 Report Review",
    "Meeting Follow-up",
    "Project Update Required",
    "Invoice #12345",
    "Weekly Newsletter",
    "Security Alert",
    "Team Lunch Tomorrow",
    "Contract Renewal",
  ];
  
  const senders = [
    { name: "John Smith", email: "john@client.com" },
    { name: "Sarah Johnson", email: "sarah@partner.com" },
    { name: "Mike Williams", email: "mike@vendor.com" },
    { name: "Emily Davis", email: "emily@company.com" },
  ];

  return Array.from({ length: 50 }, (_, i) => ({
    id: `msg-${accountId}-${i}`,
    accountId,
    threadId: `thread-${Math.floor(i / 3)}`,
    from: senders[i % senders.length],
    subject: `${subjects[i % subjects.length]} - ${i + 1}`,
    preview: "This is a preview of the email message content that will be displayed in the list...",
    date: new Date(Date.now() - i * 3600000).toISOString(),
    isUnread: i < 10,
    isFlagged: i % 7 === 0,
    hasAttachments: i % 5 === 0,
    labels: ["Inbox", i % 3 === 0 ? "Important" : ""],
  }));
};

interface MessageListProps {
  selectedAccount: Account | null;
  selectedMessage: Message | null;
  onSelectMessage: (message: Message) => void;
  searchQuery: string;
  filterUnread: boolean;
  filterFlagged: boolean;
}

const MessageList = ({
  selectedAccount,
  selectedMessage,
  onSelectMessage,
  searchQuery,
  filterUnread,
  filterFlagged,
}: MessageListProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (selectedAccount) {
      setIsLoading(true);
      // Simulate API call
      setTimeout(() => {
        setMessages(generateMockMessages(selectedAccount.id));
        setIsLoading(false);
      }, 300);
    } else {
      setMessages([]);
    }
  }, [selectedAccount]);

  const filteredMessages = messages.filter((msg) => {
    if (searchQuery && !msg.subject.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !msg.from.name.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    if (filterUnread && !msg.isUnread) return false;
    if (filterFlagged && !msg.isFlagged) return false;
    return true;
  });

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / 3600000);
    
    if (hours < 24) {
      return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    } else if (hours < 168) {
      return date.toLocaleDateString("en-US", { weekday: "short" });
    } else {
      return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    }
  };

  if (!selectedAccount) {
    return (
      <div className="flex-1 flex items-center justify-center bg-muted/20">
        <div className="text-center">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Circle className="w-8 h-8 text-primary" />
          </div>
          <h3 className="text-lg font-semibold mb-2">Select an Account</h3>
          <p className="text-sm text-muted-foreground">
            Choose a client account to view their messages
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-96 border-r bg-background flex flex-col">
      <div className="p-4 border-b">
        <h2 className="font-semibold">{selectedAccount.name}</h2>
        <p className="text-sm text-muted-foreground">{filteredMessages.length} messages</p>
      </div>

      <ScrollArea className="flex-1 scrollbar-thin">
        {isLoading ? (
          <div className="p-2 space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
        ) : (
          <div>
            {filteredMessages.map((message) => (
              <button
                key={message.id}
                onClick={() => onSelectMessage(message)}
                className={cn(
                  "w-full text-left p-4 border-b transition-colors",
                  "hover:bg-hover-bg",
                  selectedMessage?.id === message.id && "bg-selected-bg",
                  message.isUnread && "bg-unread-bg"
                )}
              >
                <div className="flex items-start gap-3">
                  {message.isUnread && (
                    <div className="w-2 h-2 rounded-full bg-unread-indicator mt-2 flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <span className={cn(
                        "text-sm truncate",
                        message.isUnread && "font-semibold"
                      )}>
                        {message.from.name}
                      </span>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatDate(message.date)}
                      </span>
                    </div>
                    <div className={cn(
                      "text-sm mb-1 truncate",
                      message.isUnread ? "font-medium" : "text-muted-foreground"
                    )}>
                      {message.subject}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {message.preview}
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      {message.isFlagged && (
                        <Star className="w-3 h-3 fill-accent text-accent" />
                      )}
                      {message.hasAttachments && (
                        <Paperclip className="w-3 h-3 text-muted-foreground" />
                      )}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
};

export default MessageList;
