import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { 
  Reply, 
  Forward, 
  Star, 
  Archive, 
  Trash2, 
  Send, 
  MoreHorizontal,
  ChevronDown,
  Paperclip,
  FileText,
  Image as ImageIcon,
  File,
  Clock,
  Smile,
  Plus
} from "lucide-react";
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

  const getInitials = (name: string) => {
    return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  };

  const participants = [
    { name: "All", count: 3 },
    { name: "Alex", avatar: "A" },
    { name: "Sarah", avatar: "S" },
  ];

  const attachments = [
    { name: "cmd.center.fig", size: "21 MB", icon: FileText, color: "text-pink-500" },
    { name: "comments.docx", size: "3.7 MB", icon: FileText, color: "text-blue-500" },
    { name: "img.png", size: "2.3 MB", icon: ImageIcon, color: "text-purple-500" },
    { name: "requirements.pdf", size: "1.5 MB", icon: File, color: "text-red-500" },
  ];

  return (
    <div className="flex-1 flex flex-col bg-background">
      {/* Header */}
      <div className="h-14 px-6 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">✓ Select</span>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <Filter className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <Star className={cn("h-4 w-4", message.isFlagged && "fill-accent text-accent")} />
          </Button>
          <Button variant="default" size="sm" className="h-8">
            <Reply className="h-4 w-4 mr-2" />
            Reply all
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <Star className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <Archive className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Subject and Metadata */}
      <div className="px-6 py-4 border-b border-border">
        <h1 className="text-xl font-semibold mb-2">{message.subject}</h1>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="h-4 w-4" />
          <span>March 25 - March 29</span>
        </div>
      </div>

      {/* Participants */}
      <div className="px-6 py-3 border-b border-border flex items-center gap-2">
        {participants.map((participant, i) => (
          <div key={i} className="flex items-center gap-1.5">
            {participant.avatar ? (
              <Avatar className="h-6 w-6">
                <AvatarFallback className="bg-primary/10 text-primary text-xs">
                  {participant.avatar}
                </AvatarFallback>
              </Avatar>
            ) : null}
            <span className="text-sm">{participant.name}</span>
            {participant.count && (
              <ChevronDown className="h-3 w-3" />
            )}
          </div>
        ))}
      </div>

      {/* Message Content */}
      <ScrollArea className="flex-1 scrollbar-thin">
        <div className="p-6 max-w-4xl">
          {/* AI Summary */}
          <div className="mb-6 p-4 rounded-lg border-2 border-ai-summary-border bg-ai-summary-bg">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium">AI Summary</span>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Design review of new email client features. Team discussed command center improvements and category 
              system. General positive feedback, with suggestions for quick actions placement.
            </p>
          </div>

          {/* Attachments */}
          {message.hasAttachments && (
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-sm font-medium">Attachments</span>
                <span className="text-sm text-muted-foreground">[4]</span>
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="grid grid-cols-4 gap-3">
                {attachments.map((file, i) => (
                  <div
                    key={i}
                    className="flex flex-col items-center gap-2 p-3 rounded-lg border border-border hover:bg-hover-bg transition-colors cursor-pointer"
                  >
                    <file.icon className={cn("h-6 w-6", file.color)} />
                    <div className="text-center">
                      <div className="text-xs font-medium truncate w-full">{file.name}</div>
                      <div className="text-xs text-muted-foreground">{file.size}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <Separator className="my-6" />

          {/* Thread Messages */}
          <div className="space-y-6">
            {/* First Message */}
            <div>
              <div className="flex items-start gap-4 mb-4">
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-primary/10 text-primary">
                    {getInitials(message.from.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <div>
                      <div className="font-semibold">{message.from.name}</div>
                      <div className="text-sm text-muted-foreground">To: Alex, Sarah</div>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      March 25, 10:15 AM
                    </div>
                  </div>
                </div>
              </div>

              <div className="ml-14 text-sm leading-relaxed space-y-3">
                <p>
                  yo team, I've updated the email client design with some new interactions. taking a different 
                  approach with the command center - much cleaner now. check out the new flows and let me know 
                  what you think!
                </p>
                <div className="pt-2">
                  <div className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                    <Paperclip className="h-3 w-3" />
                    <span>cmd.center.fig 21 MB</span>
                  </div>
                </div>
              </div>

              <div className="ml-14 mt-4 flex items-center gap-2">
                <Button variant="ghost" size="sm" className="h-8">
                  <Reply className="h-3 w-3 mr-2" />
                  Reply
                </Button>
                <Button variant="ghost" size="sm" className="h-8">
                  <Forward className="h-3 w-3 mr-2" />
                  Forward
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Smile className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <Separator />

            {/* Second Message */}
            <div>
              <div className="flex items-start gap-4 mb-4">
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-purple-500/10 text-purple-500">
                    S
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <div>
                      <div className="font-semibold">Sarah</div>
                      <div className="text-sm text-muted-foreground">To: Ali</div>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      March 25, 2:30 PM
                    </div>
                  </div>
                </div>
              </div>

              <div className="ml-14 text-sm leading-relaxed space-y-3">
                <p>
                  I've spent some time playing with the new version and have quite a few thoughts. The command 
                  center is definitely moving in the right direction - the new layout makes much more sense for 
                  power users. Really like how you've integrated the keyboard shortcuts naturally into the UI.
                </p>
                <p>
                  Let me know what you think about these points. Happy to jump on a call to discuss in detail.
                </p>
              </div>

              <div className="ml-14 mt-4 flex items-center gap-2">
                <Button variant="ghost" size="sm" className="h-8">
                  <Reply className="h-3 w-3 mr-2" />
                  Reply
                </Button>
                <Button variant="ghost" size="sm" className="h-8">
                  <Forward className="h-3 w-3 mr-2" />
                  Forward
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Smile className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Reply Section */}
          {!isReplying ? (
            <div className="mt-8">
              <Button
                onClick={() => setIsReplying(true)}
                disabled={userRole === "viewer"}
                className="w-full"
              >
                <Reply className="w-4 h-4 mr-2" />
                Reply to all
              </Button>
              {userRole === "viewer" && (
                <p className="text-sm text-muted-foreground text-center mt-2">
                  View-only access
                </p>
              )}
            </div>
          ) : (
            <div className="mt-8 space-y-4">
              <div>
                <Textarea
                  placeholder="Type your reply..."
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  className="min-h-32 bg-input border-border"
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex gap-2">
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <Paperclip className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <Smile className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setIsReplying(false);
                      setReplyText("");
                    }}
                    disabled={isSending}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSendReply}
                    disabled={!replyText.trim() || isSending}
                  >
                    <Send className="w-4 h-4 mr-2" />
                    {isSending ? "Sending..." : "Send"}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

// Missing imports for X and Filter icons
import { X, Filter } from "lucide-react";

export default MessageDetail;
