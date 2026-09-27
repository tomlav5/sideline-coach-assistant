import { useState } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface Player {
  id: string;
  first_name: string;
  last_name: string;
  jersey_number?: number;
}

/** A labelled, ordered slice of the list (UX-029) — e.g. "On pitch" / "Bench". */
export interface PlayerGroup {
  label: string;
  players: Player[];
}

interface PlayerSelectorProps {
  /** Flat, unlabelled list. Ignored when `groups` is provided. */
  players?: Player[];
  /**
   * Ordered, labelled groups (UX-029) — rendered as separate headed sections,
   * in array order, with each group's own player order preserved. Takes
   * priority over `players` when given.
   */
  groups?: PlayerGroup[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  emptyMessage?: string;
  excludePlayerId?: string;
  allowNone?: boolean;
}

export function PlayerSelector({
  players,
  groups,
  value,
  onValueChange,
  placeholder = 'Select player',
  emptyMessage = 'No player found',
  excludePlayerId,
  allowNone = false,
}: PlayerSelectorProps) {
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');

  // Normalize to groups so flat mode is just a single unlabelled group —
  // one rendering path, no behaviour drift between the two.
  const sourceGroups: PlayerGroup[] = groups ?? [{ label: '', players: players ?? [] }];

  // A player cannot assist their own goal (UX-033): drop them from every
  // group entirely, not just filter them out of the visible search results.
  const excludedGroups = sourceGroups.map((g) => ({
    ...g,
    players: g.players.filter((p) => (excludePlayerId ? p.id !== excludePlayerId : true)),
  }));

  const filteredPlayers = excludedGroups.flatMap((g) => g.players);

  const selectedPlayer = filteredPlayers.find(p => p.id === value);

  const displayText = selectedPlayer
    ? `${selectedPlayer.jersey_number ? `#${selectedPlayer.jersey_number} ` : ''}${selectedPlayer.first_name} ${selectedPlayer.last_name}`
    : value === 'none' && allowNone
    ? 'No assist'
    : placeholder;

  return (
    <Popover 
      open={open} 
      onOpenChange={(isOpen) => {
        setOpen(isOpen);
        // Clear search when closing
        if (!isOpen) {
          setSearchValue('');
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          <span className="truncate">{displayText}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput 
            placeholder="Type to search..." 
            value={searchValue}
            onValueChange={setSearchValue}
          />
          <CommandEmpty>{emptyMessage}</CommandEmpty>
          <div className="max-h-64 overflow-auto">
            {allowNone && (
              <CommandGroup>
                <CommandItem
                  value="none"
                  onSelect={() => {
                    onValueChange('none');
                    setOpen(false);
                    setSearchValue('');
                  }}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      value === 'none' ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  No assist
                </CommandItem>
              </CommandGroup>
            )}
            {excludedGroups.map((group) => {
              const visible = group.players.filter((player) => {
                if (!searchValue) return true;
                const search = searchValue.toLowerCase();
                const fullName = `${player.first_name} ${player.last_name}`.toLowerCase();
                const jerseyMatch = player.jersey_number?.toString().includes(searchValue);
                return fullName.includes(search) || jerseyMatch;
              });
              // Empty groups (search matched nothing in this group, or a
              // bench with no one on it) render nothing — no stray heading.
              if (visible.length === 0) return null;
              return (
                <CommandGroup key={group.label || '__flat__'} heading={group.label || undefined}>
                  {visible.map((player) => (
                    <CommandItem
                      key={player.id}
                      value={player.id}
                      onSelect={() => {
                        onValueChange(player.id);
                        setOpen(false);
                        setSearchValue('');
                      }}
                    >
                      <Check
                        className={cn(
                          'mr-2 h-4 w-4',
                          value === player.id ? 'opacity-100' : 'opacity-0'
                        )}
                      />
                      {player.jersey_number && `#${player.jersey_number} `}
                      {player.first_name} {player.last_name}
                    </CommandItem>
                  ))}
                </CommandGroup>
              );
            })}
          </div>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
