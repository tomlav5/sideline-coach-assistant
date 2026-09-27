import { Fragment } from 'react';
import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { PlayerGroup } from '@/components/match/PlayerSelector';

/**
 * Presentational, always-visible player list (UX-036, UX-038) — no Popover,
 * no Command, no combobox, no internal search state. `PlayerSelector` is a
 * trigger-button-plus-popup, which cost QuickGoalButton's touchline "Goal"
 * flow an extra tap and put a second amber-adjacent element on screen next to
 * the primary Goal button; this is the same grouped-list content
 * `PlayerSelector` renders inside its popover, but inline, matching
 * QuickGoalButton's original full-width-button-in-a-ScrollArea layout.
 *
 * Groups render in array order, each player in the order given (UX-029) —
 * this component invents no ordering of its own. A group left empty by the
 * search filter renders nothing, not an orphaned heading.
 */
interface PlayerPickerListProps {
  groups: PlayerGroup[];
  onSelect: (playerId: string) => void;
  /** Search text is owned by the parent — no internal state here. */
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  emptyMessage?: string;
  /** An always-visible non-player row above the groups, e.g. "No Assist". */
  leadingAction?: { label: string; onSelect: () => void };
  disabled?: boolean;
  autoFocusSearch?: boolean;
}

export function PlayerPickerList({
  groups,
  onSelect,
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Search player name or number...',
  emptyMessage = 'No players found',
  leadingAction,
  disabled = false,
  autoFocusSearch = false,
}: PlayerPickerListProps) {
  const search = searchValue.toLowerCase();
  const matchesSearch = (player: PlayerGroup['players'][number]) => {
    if (!searchValue) return true;
    const fullName = `${player.first_name} ${player.last_name}`.toLowerCase();
    const jerseyMatch = player.jersey_number?.toString().includes(searchValue);
    return fullName.includes(search) || jerseyMatch;
  };

  const visibleGroups = groups
    .map((group) => ({ ...group, players: group.players.filter(matchesSearch) }))
    .filter((group) => group.players.length > 0);

  const isEmpty = visibleGroups.length === 0;

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={searchPlaceholder}
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9"
          autoFocus={autoFocusSearch}
        />
      </div>

      <ScrollArea className="h-[min(50dvh,400px)] border rounded-lg bg-muted/30">
        <div className="space-y-1 p-3">
          {leadingAction && (
            <Button
              onClick={leadingAction.onSelect}
              disabled={disabled}
              variant="outline"
              className="w-full h-12 justify-start mb-3 border-dashed bg-background"
            >
              {leadingAction.label}
            </Button>
          )}

          {isEmpty ? (
            <p className="text-sm text-muted-foreground text-center py-8">{emptyMessage}</p>
          ) : (
            visibleGroups.map((group, index) => (
              <Fragment key={group.label || index}>
                {group.label && (
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground px-1 py-2">
                    {group.label}
                  </p>
                )}
                {group.players.map((player) => (
                  <Button
                    key={player.id}
                    onClick={() => onSelect(player.id)}
                    disabled={disabled}
                    variant="ghost"
                    className="w-full h-14 justify-start font-normal bg-background hover:bg-accent"
                  >
                    {player.jersey_number && (
                      <Badge variant="outline" className="mr-2">
                        #{player.jersey_number}
                      </Badge>
                    )}
                    {player.first_name} {player.last_name}
                  </Button>
                ))}
              </Fragment>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
