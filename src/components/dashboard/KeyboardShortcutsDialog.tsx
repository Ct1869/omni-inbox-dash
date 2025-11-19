import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Keyboard } from "lucide-react";

interface KeyboardShortcutsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const KeyboardShortcutsDialog = ({ open, onOpenChange }: KeyboardShortcutsDialogProps) => {
  const shortcuts = [
    {
      category: "Navigation",
      items: [
        { keys: ["g", "i"], description: "Go to Gmail Inbox" },
        { keys: ["g", "o"], description: "Go to Outlook Inbox" },
        { keys: ["g", "s"], description: "Go to Settings" },
        { keys: ["Esc"], description: "Close dialog or deselect" },
      ],
    },
    {
      category: "Email Actions",
      items: [
        { keys: ["c"], description: "Compose new email" },
        { keys: ["r"], description: "Reply to email" },
        { keys: ["f"], description: "Forward email" },
        { keys: ["e"], description: "Archive email" },
        { keys: ["#"], description: "Delete email" },
        { keys: ["s"], description: "Star/unstar email" },
      ],
    },
    {
      category: "Selection",
      items: [
        { keys: ["x"], description: "Select/deselect email" },
        { keys: ["* a"], description: "Select all emails" },
        { keys: ["* n"], description: "Deselect all emails" },
      ],
    },
    {
      category: "Sync & Refresh",
      items: [
        { keys: ["Ctrl/Cmd", "r"], description: "Refresh current view" },
        { keys: ["Shift", "r"], description: "Sync all accounts" },
      ],
    },
    {
      category: "Help",
      items: [
        { keys: ["?"], description: "Show keyboard shortcuts" },
      ],
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Keyboard className="h-5 w-5" />
            <DialogTitle>Keyboard Shortcuts</DialogTitle>
          </div>
          <DialogDescription>
            Use these keyboard shortcuts to navigate and manage your emails faster
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-6">
            {shortcuts.map((section) => (
              <div key={section.category}>
                <h3 className="text-sm font-semibold mb-3 text-foreground">
                  {section.category}
                </h3>
                <div className="space-y-2">
                  {section.items.map((shortcut, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between py-2 px-3 rounded-md hover:bg-muted/50 transition-colors"
                    >
                      <span className="text-sm text-muted-foreground">
                        {shortcut.description}
                      </span>
                      <div className="flex items-center gap-1">
                        {shortcut.keys.map((key, keyIdx) => (
                          <span key={keyIdx} className="flex items-center gap-1">
                            <kbd className="px-2 py-1 text-xs font-semibold text-foreground bg-muted border border-border rounded">
                              {key}
                            </kbd>
                            {keyIdx < shortcut.keys.length - 1 && (
                              <span className="text-muted-foreground text-xs">+</span>
                            )}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        <div className="pt-4 border-t">
          <p className="text-xs text-muted-foreground">
            <strong>Note:</strong> Some shortcuts may not work in all contexts. Press{" "}
            <kbd className="px-1.5 py-0.5 text-xs font-semibold bg-muted border border-border rounded">
              ?
            </kbd>{" "}
            anytime to view this help dialog.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default KeyboardShortcutsDialog;

