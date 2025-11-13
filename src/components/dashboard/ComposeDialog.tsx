import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ComposeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: string;
  accountEmail: string;
}

const ComposeDialog = ({ open, onOpenChange, accountId, accountEmail }: ComposeDialogProps) => {
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [isSending, setIsSending] = useState(false);
  const { toast } = useToast();

  const handleSend = async () => {
    if (!to.trim() || !subject.trim()) {
      toast({ title: "Please fill in recipient and subject", variant: "destructive" });
      return;
    }

    setIsSending(true);
    try {
      const { error } = await supabase.functions.invoke('send-reply', {
        body: {
          accountId,
          composeData: {
            to,
            subject,
            body: body || " ",
          },
        },
      });

      if (error) throw error;

      toast({ title: "Email sent successfully" });
      setTo("");
      setSubject("");
      setBody("");
      onOpenChange(false);
    } catch (err: any) {
      console.error('Send email error:', err);
      toast({ title: 'Failed to send email', description: err.message, variant: 'destructive' });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>New Message</DialogTitle>
          <p className="text-sm text-muted-foreground">From: {accountEmail}</p>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="to">To</Label>
            <Input
              id="to"
              type="email"
              placeholder="recipient@example.com"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="subject">Subject</Label>
            <Input
              id="subject"
              placeholder="Email subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="body">Message</Label>
            <Textarea
              id="body"
              placeholder="Type your message here..."
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="min-h-48"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isSending}>
              Cancel
            </Button>
            <Button onClick={handleSend} disabled={isSending}>
              {isSending ? 'Sending...' : 'Send'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ComposeDialog;
