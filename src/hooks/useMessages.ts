import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Message } from '@/pages/Dashboard';

interface MessageFilters {
  accountId: string | null;
  searchQuery?: string;
  filterUnread?: boolean;
  filterFlagged?: boolean;
  isUltimateInbox?: boolean;
  provider?: 'gmail' | 'outlook';
  mailboxView?: 'inbox' | 'sent';
  accountEmail?: string;
  offset?: number;
  limit?: number;
}

/**
 * Custom hook for fetching and caching messages using React Query
 * Implements proper caching strategy to avoid unnecessary refetches
 * 
 * @param filters - Message query filters
 * @returns Cached messages, loading state, error, and mutation functions
 */
export function useMessages(filters: MessageFilters) {
  const queryClient = useQueryClient();
  const {
    accountId,
    searchQuery = '',
    filterUnread = false,
    filterFlagged = false,
    isUltimateInbox = false,
    provider,
    mailboxView = 'inbox',
    accountEmail,
    offset = 0,
    limit = 50
  } = filters;

  const { data: messages = [], isLoading, error, refetch } = useQuery({
    queryKey: ['messages', {
      accountId,
      searchQuery,
      filterUnread,
      filterFlagged,
      isUltimateInbox,
      provider,
      mailboxView,
      offset,
      limit
    }],
    queryFn: async () => {
      let query = supabase
        .from('cached_messages')
        .select('id, account_id, thread_id, sender_name, sender_email, subject, snippet, received_at, is_read, is_starred, has_attachments, labels, message_id');
      
      // Filter by account or provider
      if (!isUltimateInbox && accountId) {
        query = query.eq('account_id', accountId);
      } else if (!isUltimateInbox && !accountId) {
        return [];
      } else if (isUltimateInbox && provider) {
        const { data: accounts } = await supabase
          .from('email_accounts')
          .select('id')
          .eq('provider', provider)
          .eq('is_active', true);
        
        if (accounts && accounts.length > 0) {
          const accountIds = accounts.map(a => a.id);
          query = query.in('account_id', accountIds);
        } else {
          return [];
        }
      }

      // Apply mailbox filter
      if (accountId && accountEmail) {
        if (provider === 'gmail') {
          query = mailboxView === 'sent'
            ? query.contains('labels', ['SENT'])
            : query.contains('labels', ['INBOX']);
        } else if (provider === 'outlook') {
          if (mailboxView === 'sent') {
            query = query.eq('sender_email', accountEmail);
          } else {
            query = query.neq('sender_email', accountEmail);
          }
        }
      }

      // Apply filters
      if (filterUnread) {
        query = query.eq('is_read', false);
      }
      if (filterFlagged) {
        query = query.eq('is_starred', true);
      }
      if (searchQuery) {
        query = query.or(`subject.ilike.%${searchQuery}%,snippet.ilike.%${searchQuery}%,sender_name.ilike.%${searchQuery}%`);
      }
      
      const { data, error } = await query
        .order('received_at', { ascending: false })
        .range(offset, offset + limit - 1);
      
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
      
      return mapped;
    },
    staleTime: 30000, // Consider data fresh for 30 seconds
    gcTime: 300000, // Keep in cache for 5 minutes (renamed from cacheTime)
    enabled: !!(accountId || (isUltimateInbox && provider)), // Only run if we have required params
    refetchOnWindowFocus: false, // Don't refetch on window focus to reduce API calls
  });

  // Mutation for marking messages as read
  const markAsReadMutation = useMutation({
    mutationFn: async (messageIds: string[]) => {
      const { error } = await supabase
        .from('cached_messages')
        .update({ is_read: true })
        .in('id', messageIds);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages'] });
    }
  });

  // Mutation for toggling star/flag
  const toggleStarMutation = useMutation({
    mutationFn: async ({ messageId, isStarred }: { messageId: string; isStarred: boolean }) => {
      const { error } = await supabase
        .from('cached_messages')
        .update({ is_starred: !isStarred })
        .eq('id', messageId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages'] });
    }
  });

  // Mutation for deleting messages
  const deleteMessagesMutation = useMutation({
    mutationFn: async (messageIds: string[]) => {
      // Note: Actual deletion should be done via edge function
      // This is just for updating the cache
      return messageIds;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages'] });
    }
  });

  return {
    messages,
    isLoading,
    error,
    refetch,
    markAsRead: markAsReadMutation.mutate,
    toggleStar: toggleStarMutation.mutate,
    deleteMessages: deleteMessagesMutation.mutate,
    isMarkingRead: markAsReadMutation.isPending,
    isTogglingStar: toggleStarMutation.isPending,
    isDeleting: deleteMessagesMutation.isPending,
  };
}
