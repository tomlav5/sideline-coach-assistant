import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar, Home, Plane } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface Team {
  id: string;
  name: string;
  club: {
    id: string;
    name: string;
  };
}

interface FixtureFormData {
  team_id: string;
  opponent_name: string;
  location: string;
  fixture_type: 'home' | 'away';
  half_length: number;
  competition_type: 'league' | 'tournament' | 'friendly';
  competition_name: string;
}

interface EditFixtureDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teams: Team[];
  fixtureData: FixtureFormData;
  onFixtureDataChange: (data: FixtureFormData) => void;
  selectedDate: Date | undefined;
  onDateChange: (date: Date | undefined) => void;
  selectedTime: string;
  onTimeChange: (time: string) => void;
  onConfirm: () => void;
  isUpdating: boolean;
}

const FIXTURE_TYPES = [
  { value: 'home', label: 'Home', icon: Home },
  { value: 'away', label: 'Away', icon: Plane },
];

const COMPETITION_TYPES = [
  { value: 'league', label: 'League Match' },
  { value: 'tournament', label: 'Tournament' },
  { value: 'friendly', label: 'Friendly' },
];

export function EditFixtureDialog({
  open,
  onOpenChange,
  teams,
  fixtureData,
  onFixtureDataChange,
  selectedDate,
  onDateChange,
  selectedTime,
  onTimeChange,
  onConfirm,
  isUpdating
}: EditFixtureDialogProps) {
  const updateFixtureData = (updates: Partial<FixtureFormData>) => {
    onFixtureDataChange({ ...fixtureData, ...updates });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Fixture</DialogTitle>
          <DialogDescription>
            Update fixture details
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 px-1">
          <div>
            <Label htmlFor="edit-team" className="text-base">Team</Label>
            <Select value={fixtureData.team_id} onValueChange={(value) => updateFixtureData({ team_id: value })}>
              <SelectTrigger>
                <SelectValue placeholder="Select a team" />
              </SelectTrigger>
              <SelectContent>
                {teams.map((team) => (
                  <SelectItem key={team.id} value={team.id}>
                    {team.name} ({team.club.name})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <Label htmlFor="edit-opponent" className="text-base">Opponent</Label>
            <Input
              id="edit-opponent"
              value={fixtureData.opponent_name}
              onChange={(e) => updateFixtureData({ opponent_name: e.target.value })}
              placeholder="Opponent team name"
              className="text-base min-h-[44px]"
            />
          </div>
          
          <div>
            <Label htmlFor="edit-fixture_type">Match Type</Label>
            <Select value={fixtureData.fixture_type} onValueChange={(value: any) => updateFixtureData({ fixture_type: value })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FIXTURE_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    <div className="flex items-center">
                      <type.icon className="h-4 w-4 mr-2" />
                      {type.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <Label>Match Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !selectedDate && "text-muted-foreground"
                  )}
                >
                  <Calendar className="mr-2 h-4 w-4" />
                  {selectedDate ? format(selectedDate, "PPP") : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent
                  mode="single"
                  selected={selectedDate}
                  onSelect={onDateChange}
                  initialFocus
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>
          
          <div>
            <Label htmlFor="edit-time">Match Time</Label>
            <Input
              id="edit-time"
              type="time"
              value={selectedTime}
              onChange={(e) => onTimeChange(e.target.value)}
            />
          </div>
          
          <div>
            <Label htmlFor="edit-location">Location (Optional)</Label>
            <Input
              id="edit-location"
              value={fixtureData.location}
              onChange={(e) => updateFixtureData({ location: e.target.value })}
              placeholder="Match venue"
            />
          </div>
          
          <div>
            <Label htmlFor="edit-competition_type">Competition Type</Label>
            <Select 
              value={fixtureData.competition_type} 
              onValueChange={(value: 'league' | 'tournament' | 'friendly') => updateFixtureData({ 
                competition_type: value,
                competition_name: value === 'friendly' ? '' : fixtureData.competition_name
              })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COMPETITION_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {(fixtureData.competition_type === 'tournament' || fixtureData.competition_type === 'league') && (
            <div>
              <Label htmlFor="edit-competition_name">
                {fixtureData.competition_type === 'tournament' ? 'Tournament Name' : 'League Name'} 
                {fixtureData.competition_type === 'tournament' && <span className="text-destructive">*</span>}
              </Label>
              <Input
                id="edit-competition_name"
                value={fixtureData.competition_name}
                onChange={(e) => updateFixtureData({ competition_name: e.target.value })}
                placeholder={`Enter ${fixtureData.competition_type} name`}
              />
            </div>
          )}

          <div>
            <Label htmlFor="edit-half_length">Half Length (minutes)</Label>
            <Input
              id="edit-half_length"
              type="number"
              value={fixtureData.half_length}
              onChange={(e) => updateFixtureData({ half_length: parseInt(e.target.value) || 25 })}
              min="1"
              max="60"
            />
          </div>
          
          <div className="flex gap-2 pt-4">
            <Button onClick={onConfirm} disabled={isUpdating} className="flex-1">
              {isUpdating ? "Updating..." : "Update Fixture"}
            </Button>
            <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}