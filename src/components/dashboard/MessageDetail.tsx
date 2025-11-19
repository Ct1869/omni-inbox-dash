import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Reply,
  Forward,
  Star,
  Archive,
  Trash2,
  MoreHorizontal,
  Clock,
  Paperclip,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import type { Message } from "@/pages/Dashboard";
import { supabase } from "@/integrations/supabase/client";
import EmailViewer from "./EmailViewer";
import { replyEmailSchema } from "@/lib/validation";
import { z } from "zod";
import { useRateLimit } from "@/hooks/useRateLimit";

interface MessageDetailProps {
  message: Message | null;
  accountId?: string;
  onMessageDeleted?: () => void;
  provider?: 'gmail' | 'outlook';
}

const MessageDetail = ({ message, accountId, onMessageDeleted, provider = 'gmail' }: MessageDetailProps) => {
  const [isReplying, setIsReplying] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [loading, setLoading] = useState(false);
  const [bodyHtml, setBodyHtml] = useState<string | null>(null);
  const [bodyText, setBodyText] = useState<string | null>(null);
  const [recipients, setRecipients] = useState<string[]>([]);
  const [receivedAt, setReceivedAt] = useState<string | null>(null);
  const [hasAttachments, setHasAttachments] = useState(false);
  const [attachmentCount, setAttachmentCount] = useState<number>(0);
  const { toast } = useToast();

  // SECURITY: Rate limit email actions to prevent spam
  const rateLimitReply = useRateLimit(10, 60000); // 10 replies per minute
  const rateLimitForward = useRateLimit(5, 60000); // 5 forwards per minute
  const rateLimitDelete = useRateLimit(20, 60000); // 20 deletes per minute

  const getInitials = (name: string) => {
    return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  };

  const formattedDate = useMemo(() => {
    if (!message) return '';
    const d = receivedAt ? new Date(receivedAt) : new Date(message.date);
    return d.toLocaleString();
  }, [receivedAt, message]);

  useEffect(() => {
    const loadFullMessage = async () => {
      if (!message) return;
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('cached_messages')
          .select('body_html, body_text, recipient_emails, received_at, has_attachments, attachment_count, message_id')
          .eq('id', message.id)
          .maybeSingle();
        if (error) throw error;
        setBodyHtml(data?.body_html ?? null);
        setBodyText(data?.body_text ?? null);
        setRecipients(data?.recipient_emails ?? []);
        setReceivedAt(data?.received_at ?? null);
        setHasAttachments(!!data?.has_attachments);
        setAttachmentCount(data?.attachment_count ?? 0);

        // Mark as read when opening
        if (message.isUnread && accountId && data?.message_id) {
          const functionName = provider === 'outlook' ? 'send-outlook-reply' : 'send-reply';
          supabase.functions.invoke(functionName, {
            body: {
              accountId,
              messageId: data.message_id,
              markAsRead: true,
            },
          }).catch(err => console.error('Mark as read error:', err));
        }
      } catch (err) {
        console.error('Load message detail error:', err);
        toast({ title: 'Failed to load message content', variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    };

    loadFullMessage();
  }, [message, toast, accountId]);

  const handleReplyInternal = async () => {
    if (!message || !accountId) return;
    
    // SECURITY: Validate reply content
    const validated = replyEmailSchema.parse({
      to: message.from.email,
      body: replyText.trim()
    });

    setIsSending(true);
    try {
      const functionName = provider === 'outlook' ? 'send-outlook-reply' : 'send-reply';
      const { error } = await supabase.functions.invoke(functionName, {
        body: {
          accountId,
          messageId: message.id,
          replyText: validated.body,
        },
      });
      if (error) throw error;
      toast({ title: 'Reply sent successfully' });
      setReplyText('');
      setIsReplying(false);
    } finally {
      setIsSending(false);
    }
  };

  const handleReply = async () => {
    try {
      await rateLimitReply(handleReplyInternal)();
    } catch (err) {
      if (err instanceof z.ZodError) {
        toast({ 
          title: 'Validation error', 
          description: err.errors[0].message,
          variant: 'destructive' 
        });
      } else {
        console.error('Send reply error:', err);
        toast({ 
          title: 'Failed to send reply', 
          description: err instanceof Error ? err.message : "Unknown error",
          variant: 'destructive' 
        });
      }
    }
  };

  const handleForwardInternal = async (email: string) => {
    if (!message || !accountId) return;
    
    // SECURITY: Validate email address
    const validated = z.string().email("Invalid email format").parse(email.trim());
    
    const functionName = provider === 'outlook' ? 'send-outlook-reply' : 'send-reply';
    const { error } = await supabase.functions.invoke(functionName, {
      body: {
        accountId,
        messageId: message.id,
        forwardTo: validated,
      },
    });
    if (error) throw error;
    toast({ title: 'Message forwarded' });
  };

  const handleForward = async () => {
    const email = prompt('Forward to (email):');
    if (!email) return;
    
    try {
      await rateLimitForward(() => handleForwardInternal(email))();
    } catch (err) {
      if (err instanceof z.ZodError) {
        toast({ 
          title: 'Invalid email address', 
          description: 'Please enter a valid email address',
          variant: 'destructive' 
        });
      } else {
        console.error('Forward error:', err);
        toast({ 
          title: 'Failed to forward', 
          description: err instanceof Error ? err.message : "Unknown error",
          variant: 'destructive' 
        });
      }
    }
  };

  const handleDeleteInternal = async () => {
    if (!message || !accountId) return;
    if (!confirm('Move this message to trash?')) return;
    
    const functionName = provider === 'outlook' ? 'send-outlook-reply' : 'send-reply';
    const { error } = await supabase.functions.invoke(functionName, {
      body: {
        accountId,
        messageId: message.id,
        action: 'delete',
      },
    });
    if (error) throw error;
    toast({ title: 'Message deleted' });
    onMessageDeleted?.();
  };

  const handleDelete = async () => {
    try {
      await rateLimitDelete(handleDeleteInternal)();
    } catch (err) {
      console.error('Delete error:', err);
      toast({ 
        title: 'Failed to delete', 
        description: err instanceof Error ? err.message : "Unknown error",
        variant: 'destructive' 
      });
    }
  };

  if (!message) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Reply className="w-8 h-8 text-primary" />
          </div>
          <h3 className="text-lg font-semibold mb-2">No Message Selected</h3>
          <p className="text-sm text-muted-foreground">
            Select a message from the list to view its contents
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Header - Modern sticky header with backdrop blur */}
      <div className="flex h-14 items-center justify-between border-b border-border/40 px-6 backdrop-blur-md sticky top-0 bg-background/80 z-10">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => setIsReplying(true)}>
            <Reply className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={handleForward}>
            <Forward className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
            <Archive className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={handleDelete}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-2">
          {message.labels && message.labels.length > 0 && (
            <span className="text-xs text-muted-foreground bg-accent/50 px-2 py-1 rounded">
              {message.labels[0]}
            </span>
          )}
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Message Body - Scrollable */}
      <div className="flex-1 overflow-y-auto p-8">
        <h1 className="mb-6 text-2xl font-semibold tracking-tight text-foreground">{message.subject}</h1>
        <div className="mb-8 flex items-start justify-between">
          <div className="flex gap-3">
            <Avatar className="h-10 w-10 border border-border">
              <AvatarFallback className="bg-primary/10 text-primary">
                {getInitials(message.from.name)}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="font-medium text-foreground">{message.from.name}</span>
                <span className="text-xs text-muted-foreground">&lt;{message.from.email}&gt;</span>
              </div>
              {recipients.length > 0 && (
                <span className="text-xs text-muted-foreground">To: {recipients.join(", ")}</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-xs text-muted-foreground">{formattedDate}</div>
            {hasAttachments && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Paperclip className="h-3 w-3" />
                <span>{attachmentCount}</span>
              </div>
            )}
          </div>
        </div>
        <Separator className="mb-8 opacity-50" />
        {loading ? (
          <div className="text-sm text-muted-foreground">Loading message…</div>
        ) : (
          <div className="prose prose-invert max-w-none text-sm leading-relaxed text-foreground/90">
            <EmailViewer htmlContent={bodyHtml} textContent={bodyText} />
          </div>
        )}

        {/* Reply Section */}
        {!isReplying ? (
          <div className="mt-8">
            <Button onClick={() => setIsReplying(true)} className="w-full md:w-auto">
              <Reply className="w-4 h-4 mr-2" />
              Reply
            </Button>
          </div>
        ) : (
          <div className="mt-8 space-y-4">
            <Textarea
              placeholder="Type your reply..."
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              className="min-h-32 bg-input border-border"
            />
            <div className="flex items-center justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => {
                  setIsReplying(false);
                  setReplyText('');
                }}
                disabled={isSending}
              >
                Cancel
              </Button>
              <Button onClick={handleReply} disabled={!replyText.trim() || isSending}>
                {isSending ? 'Sending...' : 'Send Reply'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MessageDetail;
