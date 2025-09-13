import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Download, FileSpreadsheet } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import * as XLSX from 'xlsx';

interface ExportDialogProps {
  competitionFilter?: string;
}

interface ExportData {
  fixtures: any[];
  goalScorers: any[];
  assisters: any[];
  goalDetails: any[];
  playerTimesSummary: any[];
  playerTimesDetailed: any[];
}

export function ExportDialog({ competitionFilter = 'all' }: ExportDialogProps) {
  const [open, setOpen] = useState(false);
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [isExporting, setIsExporting] = useState(false);
  const { toast } = useToast();

  const fetchExportData = async (start: Date, end: Date): Promise<ExportData> => {
    let competitionCondition = {};
    if (competitionFilter !== 'all') {
      if (competitionFilter.startsWith('type:')) {
        const type = competitionFilter.replace('type:', '');
        competitionCondition = { competition_type: type };
      } else if (competitionFilter.startsWith('name:')) {
        const name = competitionFilter.replace('name:', '');
        competitionCondition = { competition_name: name };
      }
    }

    // Fetch fixtures
    const { data: fixtures, error: fixturesError } = await supabase
      .from('fixtures')
      .select(`
        id,
        scheduled_date,
        opponent_name,
        location,
        fixture_type,
        competition_type,
        competition_name,
        status,
        teams!fk_fixtures_team_id (name)
      `)
      .eq('status', 'completed')
      .gte('scheduled_date', start.toISOString())
      .lte('scheduled_date', end.toISOString())
      .match(competitionCondition)
      .order('scheduled_date', { ascending: false });

    if (fixturesError) throw fixturesError;

    // Fetch match events
    const fixtureIds = (fixtures || []).map(f => f.id);
    const { data: events, error: eventsError } = await supabase
      .from('match_events')
      .select(`
        *,
        players!fk_match_events_player_id (first_name, last_name)
      `)
      .in('fixture_id', fixtureIds);

    if (eventsError) throw eventsError;

    // Fetch player time logs
    const { data: playerTimes, error: playerTimesError } = await supabase
      .from('player_time_logs')
      .select(`
        *,
        players!fk_player_time_logs_player_id (first_name, last_name)
      `)
      .in('fixture_id', fixtureIds);

    if (playerTimesError) throw playerTimesError;

    // Process fixtures data
    const fixturesData = (fixtures || []).map(fixture => {
      const fixtureEvents = (events || []).filter(e => e.fixture_id === fixture.id);
      const ourGoals = fixtureEvents.filter(e => e.event_type === 'goal' && e.is_our_team).length;
      const opponentGoals = fixtureEvents.filter(e => e.event_type === 'goal' && !e.is_our_team).length;

      return {
        Date: format(new Date(fixture.scheduled_date), 'dd/MM/yyyy'),
        Team: fixture.teams?.name || 'Unknown',
        Opponent: fixture.opponent_name,
        Location: fixture.location || 'TBC',
        'Home/Away': fixture.fixture_type === 'home' ? 'Home' : 'Away',
        Competition: fixture.competition_name || fixture.competition_type || 'N/A',
        Status: fixture.status,
        'Our Score': ourGoals,
        'Opponent Score': opponentGoals,
        Result: fixture.status === 'completed' ? 
          (ourGoals > opponentGoals ? 'W' : ourGoals < opponentGoals ? 'L' : 'D') : 
          'N/A'
      };
    });

    // Process goal scorers and assisters
    const goalScorersMap = new Map<string, any>();
    const assistersMap = new Map<string, any>();
    const goalDetails: any[] = [];

    (fixtures || []).forEach(fixture => {
      const teamName = fixture.teams?.name || 'Unknown';
      const fixtureDate = format(new Date(fixture.scheduled_date), 'dd/MM/yyyy');
      const fixtureEvents = (events || []).filter(e => e.fixture_id === fixture.id);
      
      fixtureEvents.forEach(event => {
        if (!event.player_id || !event.players || !event.is_our_team) return;
        
        const playerId = event.player_id;
        const playerName = `${event.players.first_name} ${event.players.last_name}`;
        
        if (event.event_type === 'goal') {
          goalDetails.push({
            Date: fixtureDate,
            Player: playerName,
            Team: teamName,
            Opponent: fixture.opponent_name,
            Minute: event.total_match_minute,
            'Period ID': event.period_id,
            'Penalty Goal': event.is_penalty ? 'Yes' : 'No',
            Competition: fixture.competition_name || fixture.competition_type || 'N/A'
          });

          if (!goalScorersMap.has(playerId)) {
            goalScorersMap.set(playerId, {
              Player: playerName,
              Team: teamName,
              Goals: 0,
              'Penalty Goals': 0
            });
          }
          const scorer = goalScorersMap.get(playerId)!;
          scorer.Goals++;
          if (event.is_penalty) {
            scorer['Penalty Goals']++;
          }
        } else if (event.event_type === 'assist') {
          if (!assistersMap.has(playerId)) {
            assistersMap.set(playerId, {
              Player: playerName,
              Team: teamName,
              Assists: 0
            });
          }
          assistersMap.get(playerId)!.Assists++;
        }
      });
    });

    // Process player times
    const playerTimesDetailed: any[] = [];
    (fixtures || []).forEach(fixture => {
      const fixturePlayerTimes = (playerTimes || []).filter(pt => pt.fixture_id === fixture.id);
      
      fixturePlayerTimes.forEach(log => {
        if (!log.player_id || !log.players) return;
        
        const playerName = `${log.players.first_name} ${log.players.last_name}`;
        
        playerTimesDetailed.push({
          'Match Date': format(new Date(fixture.scheduled_date), 'dd/MM/yyyy'),
          'Opponent': fixture.opponent_name,
          'Player Name': playerName,
          'Minutes Played': log.total_period_minutes || 0,
          'Is Starter': log.is_starter ? 'Yes' : 'No'
        });
      });
    });

    return {
      fixtures: fixturesData,
      goalScorers: Array.from(goalScorersMap.values()).sort((a, b) => b.Goals - a.Goals),
      assisters: Array.from(assistersMap.values()).sort((a, b) => b.Assists - a.Assists),
      goalDetails: goalDetails.sort((a, b) => new Date(a.Date).getTime() - new Date(b.Date).getTime()),
      playerTimesSummary: [], // Can be calculated if needed
      playerTimesDetailed
    };
  };

  const handleExport = async () => {
    if (!startDate || !endDate) {
      toast({
        title: "Error",
        description: "Please select both start and end dates",
        variant: "destructive",
      });
      return;
    }

    if (startDate > endDate) {
      toast({
        title: "Error",
        description: "Start date must be before end date",
        variant: "destructive",
      });
      return;
    }

    setIsExporting(true);

    try {
      const data = await fetchExportData(startDate, endDate);

      // Create workbook
      const wb = XLSX.utils.book_new();

      // Add sheets
      if (data.fixtures.length > 0) {
        const ws = XLSX.utils.json_to_sheet(data.fixtures);
        XLSX.utils.book_append_sheet(wb, ws, "Fixtures");
      }

      if (data.goalScorers.length > 0) {
        const ws = XLSX.utils.json_to_sheet(data.goalScorers);
        XLSX.utils.book_append_sheet(wb, ws, "Goal Scorers");
      }

      if (data.assisters.length > 0) {
        const ws = XLSX.utils.json_to_sheet(data.assisters);
        XLSX.utils.book_append_sheet(wb, ws, "Assisters");
      }

      if (data.goalDetails.length > 0) {
        const ws = XLSX.utils.json_to_sheet(data.goalDetails);
        XLSX.utils.book_append_sheet(wb, ws, "Goal Details");
      }

      if (data.playerTimesDetailed.length > 0) {
        const ws = XLSX.utils.json_to_sheet(data.playerTimesDetailed);
        XLSX.utils.book_append_sheet(wb, ws, "Player Times");
      }

      // Generate filename
      const filename = `match-data-${format(startDate, 'yyyy-MM-dd')}-to-${format(endDate, 'yyyy-MM-dd')}.xlsx`;

      // Write file
      XLSX.writeFile(wb, filename);

      toast({
        title: "Success",
        description: `Data exported to ${filename}`,
      });

      setOpen(false);
    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: "Error",
        description: "Failed to export data. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <FileSpreadsheet className="h-4 w-4 mr-2" />
          Export Excel
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Export Match Data
          </DialogTitle>
          <DialogDescription>
            Export detailed match statistics to an Excel file. Select the date range for the data you want to export.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Start Date</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !startDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={setStartDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">End Date</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !endDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={setEndDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {startDate && endDate && (
            <div className="text-sm text-muted-foreground bg-muted p-3 rounded">
              <strong>Export will include:</strong>
              <ul className="mt-1 space-y-1">
                <li>• Match fixtures and results</li>
                <li>• Goal scorers and assists</li>
                <li>• Detailed goal information</li>
                <li>• Player time tracking</li>
              </ul>
            </div>
          )}
        </div>

        <div className="flex justify-end space-x-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleExport} 
            disabled={!startDate || !endDate || isExporting}
          >
            {isExporting ? "Exporting..." : "Export Excel"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}