import { useState, useEffect, useRef } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { 
  Search, 
  Star, 
  Paperclip, 
  Circle, 
  X, 
  Bell,
  Users,
  Tag,
  Zap,
  Inbox,
  RefreshCcw,
  AlertCircle,
  CheckCircle
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Account, Message } from "@/pages/Dashboard";
import { supabase } from "@/integrations/supabase/client";
import { useSyncStatus } from "@/hooks/useSyncStatus";



interface MessageListProps {
  selectedAccount: Account | null;
  selectedMessage: Message | null;
  onSelectMessage: (message: Message) => void;
  searchQuery: string;
  filterUnread: boolean;
  filterFlagged: boolean;
  refreshTrigger: number;
  isUltimateInbox?: boolean;
  mailboxView: "inbox" | "sent";
}

const MessageList = ({
  selectedAccount,
  selectedMessage,
  onSelectMessage,
  searchQuery,
  filterUnread,
  filterFlagged,
  refreshTrigger,
  isUltimateInbox = false,
  mailboxView,
}: MessageListProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [localSearch, setLocalSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isMarkingRead, setIsMarkingRead] = useState(false);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const MESSAGES_PER_PAGE = 50;
  const scrollViewportRef = useRef<HTMLDivElement>(null);
  
  const syncStatuses = useSyncStatus(selectedAccount ? [selectedAccount.id] : undefined);
  const syncStatus = selectedAccount ? syncStatuses.get(selectedAccount.id) : undefined;

  useEffect(() => {
    const fetchMessages = async () => {
      setIsLoading(true);
      setOffset(0);
      try {
        let query = supabase
          .from('cached_messages')
          .select('id, account_id, thread_id, sender_name, sender_email, subject, snippet, received_at, is_read, is_starred, has_attachments, labels, message_id');
        
        // If not ultimate inbox, filter by selected account
        if (!isUltimateInbox && selectedAccount) {
          query = query.eq('account_id', selectedAccount.id);
        } else if (!isUltimateInbox && !selectedAccount) {
          setMessages([]);
          setIsLoading(false);
          return;
        }

        // Filter by mailbox view
        if (mailboxView === "sent") {
          query = query.contains("labels", ["SENT"]);
        } else {
          query = query.contains("labels", ["INBOX"]);
        }
        
        const { data, error } = await query
          .order('received_at', { ascending: false })
          .range(0, MESSAGES_PER_PAGE - 1);
        
        if (error) throw error;
        const mapped: Message[] = (data || []).map((m: any) => ({
          id: m.id,
          accountId: m.account_id,
          threadId: m.thread_id || '',
          from: { name: m.sender_name || m.sender_email, email: m.sender_email },
          subject: m.subject || '(no subject)',
          preview: m.snippet || '',
          date: m.received_at,
          isUnread: !m.is_read,
          isFlagged: m.is_starred,
          hasAttachments: m.has_attachments,
          labels: m.labels || [],
          messageId: m.message_id,
        }));
        setMessages(mapped);
        setHasMore(data?.length === MESSAGES_PER_PAGE);
        setOffset(MESSAGES_PER_PAGE);
      } catch (err) {
        console.error('Load messages error:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMessages();
    setSelectedIds(new Set());

    // Subscribe to real-time updates
    const channel = supabase
      .channel('cached-messages-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'cached_messages',
          filter: selectedAccount ? `account_id=eq.${selectedAccount.id}` : undefined,
        },
        (payload) => {
          console.log('Real-time message update:', payload);
          
          if (payload.eventType === 'INSERT') {
            const m = payload.new as any;
            const newMessage: Message = {
              id: m.id,
              accountId: m.account_id,
              threadId: m.thread_id || '',
              from: { name: m.sender_name || m.sender_email, email: m.sender_email },
              subject: m.subject || '(no subject)',
              preview: m.snippet || '',
              date: m.received_at,
              isUnread: !m.is_read,
              isFlagged: m.is_starred,
              hasAttachments: m.has_attachments,
              labels: m.labels || [],
              messageId: m.message_id,
            };
            setMessages(prev => [newMessage, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            const m = payload.new as any;
            setMessages(prev => prev.map(msg => 
              msg.id === m.id
                ? {
                    ...msg,
                    isUnread: !m.is_read,
                    isFlagged: m.is_starred,
                  }
                : msg
            ));
          } else if (payload.eventType === 'DELETE') {
            setMessages(prev => prev.filter(msg => msg.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedAccount, refreshTrigger, isUltimateInbox, mailboxView]);

  const loadMoreMessages = async () => {
    if (!hasMore || isLoading || isLoadingMore) return;
    
    setIsLoadingMore(true);
    try {
      let query = supabase
        .from('cached_messages')
        .select('id, account_id, thread_id, sender_name, sender_email, subject, snippet, received_at, is_read, is_starred, has_attachments, labels, message_id');
      
      if (!isUltimateInbox && selectedAccount) {
        query = query.eq('account_id', selectedAccount.id);
      }

      // Filter by mailbox view
      if (mailboxView === "sent") {
        query = query.contains("labels", ["SENT"]);
      } else {
        query = query.contains("labels", ["INBOX"]);
      }
      
      const { data, error } = await query
        .order('received_at', { ascending: false })
        .range(offset, offset + MESSAGES_PER_PAGE - 1);
      
      if (error) throw error;
      
      const mapped: Message[] = (data || []).map((m: any) => ({
        id: m.id,
        accountId: m.account_id,
        threadId: m.thread_id || '',
        from: { name: m.sender_name || m.sender_email, email: m.sender_email },
        subject: m.subject || '(no subject)',
        preview: m.snippet || '',
        date: m.received_at,
        isUnread: !m.is_read,
        isFlagged: m.is_starred,
        hasAttachments: m.has_attachments,
        labels: m.labels || [],
        messageId: m.message_id,
      }));
      
      setMessages(prev => [...prev, ...mapped]);
      setHasMore(data?.length === MESSAGES_PER_PAGE);
      setOffset(prev => prev + MESSAGES_PER_PAGE);
    } catch (err) {
      console.error('Load more messages error:', err);
    } finally {
      setIsLoadingMore(false);
    }
  };

  const handleScroll = () => {
    const viewport = scrollViewportRef.current;
    if (!viewport) return;
    
    const scrollPercentage = (viewport.scrollTop + viewport.clientHeight) / viewport.scrollHeight;
    
    // Load more when scrolled to 80% of the content
    if (scrollPercentage > 0.8 && hasMore && !isLoadingMore && !isLoading) {
      loadMoreMessages();
    }
  };

  // Attach scroll handler to viewport
  useEffect(() => {
    const viewport = scrollViewportRef.current;
    if (!viewport) return;

    viewport.addEventListener('scroll', handleScroll);
    return () => viewport.removeEventListener('scroll', handleScroll);
  }, [hasMore, isLoadingMore, isLoading, offset]);

  const filteredMessages = messages.filter((msg) => {
    const query = (searchQuery || localSearch).toLowerCase();
    if (query && !msg.subject.toLowerCase().includes(query) &&
        !msg.from.name.toLowerCase().includes(query) &&
        !msg.from.email.toLowerCase().includes(query)) {
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
    
    if (hours < 1) return "Just now";
    if (hours < 24) return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    if (hours < 168) return date.toLocaleDateString("en-US", { weekday: "short" });
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const getInitials = (name: string) => {
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  };

  const handleToggleSelect = (messageId: string) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(messageId)) {
        newSet.delete(messageId);
      } else {
        newSet.add(messageId);
      }
      return newSet;
    });
  };

  const handleMarkSelectedAsRead = async () => {
    if (selectedIds.size === 0) return;
    setIsMarkingRead(true);
    
    try {
      // Group by account
      const messagesByAccount = new Map<string, string[]>();
      messages.forEach(msg => {
        if (selectedIds.has(msg.id) && msg.messageId) {
          const accountMsgs = messagesByAccount.get(msg.accountId) || [];
          accountMsgs.push(msg.messageId);
          messagesByAccount.set(msg.accountId, accountMsgs);
        }
      });

      // Mark as read for each account
      for (const [accountId, messageIds] of messagesByAccount.entries()) {
        await supabase.functions.invoke('send-reply', {
          body: {
            accountId,
            messageIds,
            action: 'markAsRead',
          },
        });
      }
      
      setSelectedIds(new Set());
      // Refresh will happen via parent
    } catch (err) {
      console.error('Mark as read error:', err);
    } finally {
      setIsMarkingRead(false);
    }
  };

  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    setIsDeleting(true);
    
    try {
      // Group messages by account
      const messagesByAccount = new Map<string, string[]>();
      messages.forEach(msg => {
        if (selectedIds.has(msg.id)) {
          const accountMsgs = messagesByAccount.get(msg.accountId) || [];
          accountMsgs.push(msg.id);
          messagesByAccount.set(msg.accountId, accountMsgs);
        }
      });

      // Delete for each account
      for (const [accountId, messageIds] of messagesByAccount.entries()) {
        await supabase.functions.invoke('send-reply', {
          body: {
            accountId,
            messageIds,
            action: 'delete',
          },
        });
      }
      
      // Remove deleted messages from local state
      setMessages(prev => prev.filter(msg => !selectedIds.has(msg.id)));
      setSelectedIds(new Set());
    } catch (err) {
      console.error('Delete error:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  if (!selectedAccount && !isUltimateInbox) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background">
        <div className="text-center max-w-sm">
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
    <div className="w-full lg:w-[420px] border-r border-border bg-card flex flex-col min-h-0">
      {/* Sync Status Header */}
      {syncStatus?.status === "running" && (
        <div className="px-4 py-2 bg-blue-50 dark:bg-blue-950/30 border-b border-blue-200 dark:border-blue-800 flex items-center gap-2">
          <RefreshCcw className="animate-spin text-blue-600 dark:text-blue-400 h-4 w-4" />
          <span className="text-sm text-blue-800 dark:text-blue-300">
            Syncing messages... {syncStatus.messagesSynced} processed
          </span>
        </div>
      )}

      {syncStatus?.status === "failed" && (
        <div className="px-4 py-2 bg-red-50 dark:bg-red-950/30 border-b border-red-200 dark:border-red-800 flex items-center gap-2">
          <AlertCircle className="text-red-600 dark:text-red-400 h-4 w-4" />
          <span className="text-sm text-red-800 dark:text-red-300 flex-1 truncate">
            Sync failed: {syncStatus.errorMessage}
          </span>
        </div>
      )}

      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">
            {isUltimateInbox ? 'Ultimate Inbox' : selectedAccount?.name}
          </h2>
          {selectedIds.size > 0 && (
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleMarkSelectedAsRead}
                disabled={isMarkingRead || isDeleting}
              >
                Mark {selectedIds.size} as read
              </Button>
              <Button 
                variant="destructive" 
                size="sm"
                onClick={handleDeleteSelected}
                disabled={isDeleting || isMarkingRead}
              >
                Delete {selectedIds.size}
              </Button>
            </div>
          )}
        </div>

        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search messages..."
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            className="pl-9 bg-input border-border"
          />
        </div>
      </div>

      {/* Messages List */}
      <div 
        className="flex-1 overflow-auto scrollbar-thin"
        ref={scrollViewportRef}
      >
        {isLoading && messages.length === 0 ? (
          <div className="p-2 space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-20 bg-muted/20 animate-pulse rounded-md" />
            ))}
          </div>
        ) : filteredMessages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-center p-8">
            <div>
              <Inbox className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {messages.length === 0 ? "No messages yet. Click 'Sync Now' to fetch emails." : "No messages match your filters"}
              </p>
            </div>
          </div>
        ) : (
          <div>
            {filteredMessages.map((message) => (
              <MessageItem
                key={message.id}
                message={message}
                isSelected={selectedMessage?.id === message.id}
                onSelect={onSelectMessage}
                isCheckboxSelected={selectedIds.has(message.id)}
                onToggleCheckbox={handleToggleSelect}
              />
            ))}
            {hasMore && !isLoadingMore && (
              <div className="p-4 bg-background">
                <Button 
                  variant="outline" 
                  onClick={loadMoreMessages}
                  disabled={isLoadingMore}
                  className="w-full bg-background hover:bg-muted border-border"
                >
                  Load More
                </Button>
              </div>
            )}
            {isLoadingMore && (
              <div className="p-4 flex justify-center bg-background">
                <RefreshCcw className="animate-spin h-4 w-4 mr-2" />
                <span className="text-muted-foreground text-sm">Loading more messages...</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

interface MessageItemProps {
  message: Message;
  isSelected: boolean;
  onSelect: (message: Message) => void;
  isCheckboxSelected: boolean;
  onToggleCheckbox: (id: string) => void;
}

const MessageItem = ({ 
  message, 
  isSelected, 
  onSelect, 
  isCheckboxSelected, 
  onToggleCheckbox 
}: MessageItemProps) => {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / 3600000);
    
    if (hours < 1) return "Just now";
    if (hours < 24) return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    if (hours < 168) return date.toLocaleDateString("en-US", { weekday: "short" });
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const getInitials = (name: string) => {
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  };

  const getBrandInfo = (email: string, name: string) => {
    const domain = email.toLowerCase().split('@')[1] || '';
    const nameLower = name.toLowerCase();
    
    // Brand detection
    const brands: Record<string, { color: string; initial: string }> = {
      'stripe.com': { color: 'bg-[#635BFF] text-white', initial: 'S' },
      'netflix.com': { color: 'bg-[#E50914] text-white', initial: 'N' },
      'linkedin.com': { color: 'bg-[#0A66C2] text-white', initial: 'in' },
      'asana.com': { color: 'bg-[#F06A6A] text-white', initial: 'A' },
      'figma.com': { color: 'bg-[#F24E1E] text-white', initial: 'F' },
      'docusign.com': { color: 'bg-[#FFCD00] text-black', initial: 'D' },
      'github.com': { color: 'bg-[#181717] text-white', initial: 'G' },
      'google.com': { color: 'bg-[#4285F4] text-white', initial: 'G' },
      'apple.com': { color: 'bg-black text-white', initial: 'A' },
      'microsoft.com': { color: 'bg-[#00A4EF] text-white', initial: 'M' },
      'slack.com': { color: 'bg-[#4A154B] text-white', initial: 'S' },
      'dropbox.com': { color: 'bg-[#0061FF] text-white', initial: 'D' },
      'zoom.us': { color: 'bg-[#2D8CFF] text-white', initial: 'Z' },
      'salesforce.com': { color: 'bg-[#00A1E0] text-white', initial: 'S' },
      'notion.so': { color: 'bg-black text-white', initial: 'N' },
      'trello.com': { color: 'bg-[#0079BF] text-white', initial: 'T' },
      'shopify.com': { color: 'bg-[#7AB55C] text-white', initial: 'S' },
    };
    
    // Check domain
    if (brands[domain]) {
      return brands[domain];
    }
    
    // Check name for brand keywords
    for (const [key, value] of Object.entries(brands)) {
      const brandName = key.split('.')[0];
      if (nameLower.includes(brandName)) {
        return value;
      }
    }
    
    return null;
  };

  return (
    <div
      className={cn(
        "px-4 py-3 border-b border-border cursor-pointer transition-colors hover:bg-muted/30",
        isSelected && "bg-muted/50",
        message.isUnread && "bg-muted/20"
      )}
    >
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={isCheckboxSelected}
          onChange={(e) => {
            e.stopPropagation();
            onToggleCheckbox(message.id);
          }}
          className="mt-3 h-4 w-4 rounded border-border"
        />
        <div onClick={() => onSelect(message)} className="flex items-start gap-3 flex-1">
          <Avatar className="h-10 w-10 flex-shrink-0">
            <AvatarFallback className={cn(
              "text-sm font-semibold",
              getBrandInfo(message.from.email, message.from.name)?.color || "bg-primary/10 text-primary"
            )}>
              {getBrandInfo(message.from.email, message.from.name)?.initial || getInitials(message.from.name)}
            </AvatarFallback>
          </Avatar>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <span className={cn(
                "text-sm truncate",
                message.isUnread && "font-semibold"
              )}>
                {message.from.name}
              </span>
              <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">
                {formatDate(message.date)}
              </span>
            </div>
            
            <div className={cn(
              "text-sm truncate mb-1",
              message.isUnread && "font-medium"
            )}>
              {message.subject}
            </div>
            
            <div className="text-xs text-muted-foreground truncate">
              {message.preview}
            </div>
            
            <div className="flex items-center gap-2 mt-1">
              {message.isFlagged && <Star className="h-3 w-3 fill-accent text-accent" />}
              {message.hasAttachments && <Paperclip className="h-3 w-3 text-muted-foreground" />}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MessageList;
