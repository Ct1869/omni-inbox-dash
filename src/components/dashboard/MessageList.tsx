import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import debounce from "lodash.debounce";
import throttle from "lodash.throttle";
import { useSearchParams } from "react-router-dom";
import { Virtuoso } from 'react-virtuoso';
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
import MessageItem from "./MessageItem";
import { MessageListSkeleton } from "@/components/skeletons/MessageListSkeleton";



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
  onMailboxViewChange?: (view: "inbox" | "sent") => void;
  provider?: "gmail" | "outlook";
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
  onMailboxViewChange,
  provider,
}: MessageListProps) => {
  // PERFORMANCE: Use URL search params to persist pagination state across navigation
  const [searchParams, setSearchParams] = useSearchParams();
  const page = parseInt(searchParams.get('page') || '1');
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [localSearch, setLocalSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isMarkingRead, setIsMarkingRead] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const MESSAGES_PER_PAGE = 50;
  const offset = (page - 1) * MESSAGES_PER_PAGE;
  const scrollViewportRef = useRef<HTMLDivElement>(null);
  
  const syncStatuses = useSyncStatus(selectedAccount ? [selectedAccount.id] : undefined);
  const syncStatus = selectedAccount ? syncStatuses.get(selectedAccount.id) : undefined;

  // PERFORMANCE: Restore scroll position when returning to a page
  useEffect(() => {
    if (!selectedAccount?.id) return;
    
    const savedPosition = sessionStorage.getItem(`scroll-${selectedAccount.id}`);
    if (savedPosition && scrollViewportRef.current) {
      setTimeout(() => {
        scrollViewportRef.current?.scrollTo(0, parseInt(savedPosition));
      }, 100); // Small delay to ensure content is rendered
    }
  }, [selectedAccount?.id, page]);

  // PERFORMANCE: Save scroll position when user scrolls AND trigger load more
  const handleScroll = useCallback(
    throttle(() => {
      const viewport = scrollViewportRef.current;
      if (!viewport) return;
      
      // Save scroll position for restoration
      if (selectedAccount?.id) {
        sessionStorage.setItem(`scroll-${selectedAccount.id}`, String(viewport.scrollTop));
      }
      
      // Load more when scrolled to 80% of the content
      const scrollPercentage = (viewport.scrollTop + viewport.clientHeight) / viewport.scrollHeight;
      if (scrollPercentage > 0.8 && hasMore && !isLoadingMore && !isLoading) {
        loadMoreMessages();
      }
    }, 200),
    [selectedAccount?.id, hasMore, isLoadingMore, isLoading]
  );

  useEffect(() => {
    const fetchMessages = async () => {
      setIsLoading(true);
      // Reset page to 1 when account/filter changes
      if (page !== 1) {
        setSearchParams({ page: '1' });
        return;
      }

      console.log('[MessageList] Fetching messages...', {
        selectedAccount: selectedAccount?.email,
        isUltimateInbox,
        provider,
        mailboxView
      });

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
        } else if (isUltimateInbox && provider) {
          // Filter by provider in ultimate inbox mode
          const { data: accounts } = await supabase
            .from('email_accounts')
            .select('id')
            .eq('provider', provider)
            .eq('is_active', true);
          
          if (accounts && accounts.length > 0) {
            const accountIds = accounts.map(a => a.id);
            query = query.in('account_id', accountIds);
          } else {
            setMessages([]);
            setIsLoading(false);
            return;
          }
        }

        // Apply mailbox filter based on account provider
        if (selectedAccount) {
          if (selectedAccount.provider === 'gmail') {
            // Gmail uses labels for mailbox filtering
            query = mailboxView === 'sent'
              ? query.contains('labels', ['SENT'])
              : query.contains('labels', ['INBOX']);
          } else if (selectedAccount.provider === 'outlook') {
            // Outlook messages don't have Gmail-style labels; approximate using sender_email
            if (mailboxView === 'sent') {
              query = query.eq('sender_email', selectedAccount.email);
            } else {
              query = query.neq('sender_email', selectedAccount.email);
            }
          }
        } else {
          // Ultimate Inbox (no specific account): don't restrict by labels so Outlook messages appear
          // Optional: could OR Gmail inbox labels with Outlook empty labels, but we keep it simple and unfiltered here
        }
        
        const { data, error } = await query
          .order('received_at', { ascending: false })
          .range(offset, offset + MESSAGES_PER_PAGE - 1);

        if (error) throw error;

        console.log('[MessageList] Fetched messages:', {
          count: data?.length || 0,
          hasMore: (data?.length || 0) === MESSAGES_PER_PAGE
        });

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
      } catch (err) {
        console.error('[MessageList] Load messages error:', err);
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
        async (payload) => {
          console.log('Real-time message update:', payload);
          
          // In ultimate inbox mode with provider filter, check if message is from correct provider
          if (isUltimateInbox && provider && payload.new) {
            const m = payload.new as any;
            const { data: account } = await supabase
              .from('email_accounts')
              .select('provider')
              .eq('id', m.account_id)
              .single();
            
            if (!account || account.provider !== provider) {
              return; // Skip messages from other providers
            }
          }
          
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
  }, [selectedAccount, refreshTrigger, isUltimateInbox, mailboxView, provider, page, offset]);

  const loadMoreMessages = useCallback(() => {
    if (!hasMore || isLoading || isLoadingMore) return;

    // PERFORMANCE: Update page in URL to persist pagination state
    setSearchParams({ page: String(page + 1) });
  }, [hasMore, isLoading, isLoadingMore, page, setSearchParams]);

  // Define handleToggleSelect before it's used in renderItem
  const handleToggleSelect = useCallback((messageId: string) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(messageId)) {
        newSet.delete(messageId);
      } else {
        newSet.add(messageId);
      }
      return newSet;
    });
  }, []);

  // Memoized callbacks for Virtuoso to prevent re-renders
  const handleEndReached = useCallback(() => {
    if (hasMore && !isLoadingMore && !isLoading) {
      loadMoreMessages();
    }
  }, [hasMore, isLoadingMore, isLoading, loadMoreMessages]);

  const renderItem = useCallback((index: number, message: Message) => (
    <div className="px-2 py-1" key={message.id}>
      <MessageItem
        message={message}
        isSelected={selectedMessage?.id === message.id}
        onSelect={onSelectMessage}
        isCheckboxSelected={selectedIds.has(message.id)}
        onToggleCheckbox={handleToggleSelect}
      />
    </div>
  ), [selectedMessage, onSelectMessage, selectedIds, handleToggleSelect]);


  // Memoize filtered messages to prevent unnecessary recalculations
  const filteredMessages = useMemo(() => {
    return messages.filter((msg) => {
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
  }, [messages, searchQuery, localSearch, filterUnread, filterFlagged]);

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

  const handleMarkSelectedAsRead = useCallback(async () => {
    if (selectedIds.size === 0) return;
    
    setIsMarkingRead(true);
    
    try {
      // Group messages by account
      const messagesByAccount = new Map<string, string[]>();
      messages.forEach(msg => {
        if (selectedIds.has(msg.id) && msg.messageId) {
          const msgIds = messagesByAccount.get(msg.accountId) || [];
          msgIds.push(msg.messageId);
          messagesByAccount.set(msg.accountId, msgIds);
        }
      });

      // PERFORMANCE: Batch all requests into single Promise.allSettled
      // This prevents N+1 query problem by running all requests in parallel
      const requests = Array.from(messagesByAccount.entries()).map(
        ([accountId, messageIds]) => 
          supabase.functions.invoke('send-reply', {
            body: { accountId, messageIds, action: 'markAsRead' }
          })
      );

      const results = await Promise.allSettled(requests);
      
      // Handle results and provide user feedback
      const succeeded = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;
      
      if (failed > 0) {
        console.error('Some mark as read requests failed:', 
          results.filter(r => r.status === 'rejected').map(r => r.reason)
        );
      }
      
      if (succeeded > 0) {
        // Update local state optimistically
        setMessages(prev => prev.map(msg => 
          selectedIds.has(msg.id) ? { ...msg, isUnread: false } : msg
        ));
      }
      
      setSelectedIds(new Set());
    } catch (err) {
      console.error('Mark as read error:', err);
    } finally {
      setIsMarkingRead(false);
    }
  }, [selectedIds, messages]);


  const handleDeleteSelected = useCallback(async () => {
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

      // PERFORMANCE: Batch all delete requests into single Promise.allSettled
      // This prevents N+1 query problem by running all requests in parallel
      const requests = Array.from(messagesByAccount.entries()).map(
        ([accountId, messageIds]) =>
          supabase.functions.invoke('send-reply', {
            body: { accountId, messageIds, action: 'delete' }
          })
      );

      const results = await Promise.allSettled(requests);
      
      // Handle results
      const succeeded = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;
      
      if (failed > 0) {
        console.error('Some delete requests failed:', 
          results.filter(r => r.status === 'rejected').map(r => r.reason)
        );
      }
      
      if (succeeded > 0) {
        // Remove deleted messages from local state optimistically
        setMessages(prev => prev.filter(msg => !selectedIds.has(msg.id)));
      }
      
      setSelectedIds(new Set());
    } catch (err) {
      console.error('Delete error:', err);
    } finally {
      setIsDeleting(false);
    }
  }, [selectedIds, messages]);

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

      {/* Bulk Operation Progress Indicator */}
      {(isMarkingRead || isDeleting) && (
        <div className="px-4 py-3 bg-primary/10 border-b border-border flex items-center gap-3">
          <RefreshCcw className="animate-spin h-4 w-4 text-primary" />
          <span className="text-sm font-medium text-primary">
            {isMarkingRead && `Marking ${selectedIds.size} messages as read...`}
            {isDeleting && `Deleting ${selectedIds.size} messages...`}
          </span>
        </div>
      )}

      {/* Messages List - Virtualized for Performance */}
      <div className="flex-1 overflow-hidden">
        {isLoading && messages.length === 0 ? (
          <MessageListSkeleton />
        ) : filteredMessages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-center p-8">
            <div className="max-w-md">
              <Inbox className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">
                {messages.length === 0 ? "No messages yet" : "No messages match your filters"}
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                {messages.length === 0
                  ? "Click the 'Sync Now' button in the sidebar to fetch your emails from this account."
                  : "Try adjusting your search or filter settings."}
              </p>
              {messages.length === 0 && selectedAccount && (
                <Button
                  variant="outline"
                  onClick={() => {
                    const event = new CustomEvent('trigger-sync');
                    window.dispatchEvent(event);
                  }}
                  className="mt-2"
                >
                  <RefreshCcw className="h-4 w-4 mr-2" />
                  Sync Now
                </Button>
              )}
            </div>
          </div>
        ) : (
          <Virtuoso
            style={{ height: '100%', width: '100%' }}
            data={filteredMessages}
            endReached={handleEndReached}
            itemContent={renderItem}
            overscan={200}
          />
        )}
        {isLoadingMore && (
          <div className="p-4 flex justify-center bg-background border-t">
            <RefreshCcw className="animate-spin h-4 w-4 mr-2" />
            <span className="text-sm text-muted-foreground">Loading more messages...</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default MessageList;
