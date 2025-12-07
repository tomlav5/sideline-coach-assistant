import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Keyboard } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface KeyboardShortcutsHelpProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function KeyboardShortcutsHelp({ open, onOpenChange }: KeyboardShortcutsHelpProps) {
  const shortcuts = [
    { key: 'G', description: 'Record goal' },
    { key: 'S', description: 'Make substitution' },
    { key: 'E', description: 'Record other event' },
    { key: 'Ctrl+Z', description: 'Undo last action' },
    { key: 'Space', description: 'Start/Pause period' },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="h-5 w-5" />
            Keyboard Shortcuts
          </DialogTitle>
          <DialogDescription>
            Speed up match tracking with keyboard shortcuts
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-4">
          {shortcuts.map((shortcut, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-3 rounded-lg border"
            >
              <span className="text-sm">{shortcut.description}</span>
              <Badge variant="secondary" className="font-mono">
                {shortcut.key}
              </Badge>
            </div>
          ))}
        </div>

        <div className="text-xs text-muted-foreground">
          <p>💡 Tip: Shortcuts work when you're not typing in a text field</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function KeyboardShortcutsButton({ onClick }: { onClick: () => void }) {
  return (
    <Button
      onClick={onClick}
      variant="ghost"
      size="sm"
      className="flex items-center gap-2"
    >
      <Keyboard className="h-4 w-4" />
      <span className="hidden sm:inline">Shortcuts</span>
    </Button>
  );
}
