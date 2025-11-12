import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Reply, ReplyAll, Forward, Star, Archive, Trash2, Paperclip, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import type { Message } from "@/pages/Dashboard";

interface MessageDetailProps {
  message: Message | null;
  accountId?: string;
}

const MessageDetail = ({ message, accountId }: MessageDetailProps) => {
  const [isReplying, setIsReplying] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const { toast } = useToast();
  const userRole = localStorage.getItem("userRole");

  const handleSendReply = async () => {
    if (!replyText.trim() || !message || !accountId) return;

    setIsSending(true);
    // Simulate API call
    setTimeout(() => {
      toast({
        title: "Reply sent",
        description: "Your message has been sent successfully",
      });
      setReplyText("");
      setIsReplying(false);
      setIsSending(false);
    }, 1000);
  };

  if (!message) {
    return (
      <div className="flex-1 flex items-center justify-center bg-muted/10">
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

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="flex-1 flex flex-col bg-background">
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">{message.subject}</h2>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon">
              <Star className={cn(
                "w-4 h-4",
                message.isFlagged && "fill-accent text-accent"
              )} />
            </Button>
            <Button variant="ghost" size="icon">
              <Archive className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon">
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {message.labels.filter(Boolean).map((label) => (
            <Badge key={label} variant="secondary" className="text-xs">
              {label}
            </Badge>
          ))}
        </div>
      </div>

      {/* Message Content */}
      <ScrollArea className="flex-1 scrollbar-thin">
        <div className="p-6">
          <div className="flex items-start gap-4 mb-6">
            <Avatar>
              <AvatarFallback className="bg-primary/10 text-primary">
                {getInitials(message.from.name)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <div>
                  <div className="font-semibold">{message.from.name}</div>
                  <div className="text-sm text-muted-foreground">{message.from.email}</div>
                </div>
                <div className="text-sm text-muted-foreground">
                  {new Date(message.date).toLocaleString()}
                </div>
              </div>
            </div>
          </div>

          <div className="prose prose-sm max-w-none">
            <p className="mb-4">
              Hi there,
            </p>
            <p className="mb-4">
              {message.preview} This is the full content of the email message. In a real implementation, 
              this would be fetched from your backend API and could include rich HTML formatting, 
              inline images, and more.
            </p>
            <p className="mb-4">
              Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor 
              incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud 
              exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
            </p>
            <p>
              Best regards,<br />
              {message.from.name}
            </p>
          </div>

          {message.hasAttachments && (
            <div className="mt-6 p-4 bg-muted rounded-lg">
              <div className="flex items-center gap-2 text-sm font-medium mb-3">
                <Paperclip className="w-4 h-4" />
                Attachments (2)
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between p-2 bg-background rounded">
                  <span className="text-sm">document.pdf</span>
                  <Button variant="ghost" size="sm">Download</Button>
                </div>
                <div className="flex items-center justify-between p-2 bg-background rounded">
                  <span className="text-sm">image.png</span>
                  <Button variant="ghost" size="sm">Download</Button>
                </div>
              </div>
            </div>
          )}

          <Separator className="my-6" />

          {/* Reply Section */}
          {!isReplying ? (
            <div className="flex gap-2">
              <Button
                onClick={() => setIsReplying(true)}
                disabled={userRole === "viewer"}
              >
                <Reply className="w-4 h-4 mr-2" />
                Reply
              </Button>
              <Button
                variant="outline"
                onClick={() => setIsReplying(true)}
                disabled={userRole === "viewer"}
              >
                <ReplyAll className="w-4 h-4 mr-2" />
                Reply All
              </Button>
              <Button variant="outline" disabled={userRole === "viewer"}>
                <Forward className="w-4 h-4 mr-2" />
                Forward
              </Button>
              {userRole === "viewer" && (
                <span className="text-sm text-muted-foreground self-center ml-2">
                  (View-only access)
                </span>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <div className="text-sm font-medium mb-2">Reply to {message.from.name}</div>
                <Textarea
                  placeholder="Type your reply..."
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  className="min-h-32"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleSendReply}
                  disabled={!replyText.trim() || isSending}
                >
                  <Send className="w-4 h-4 mr-2" />
                  {isSending ? "Sending..." : "Send Reply"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsReplying(false);
                    setReplyText("");
                  }}
                  disabled={isSending}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

export default MessageDetail;
