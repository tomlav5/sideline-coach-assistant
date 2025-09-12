import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Label } from '@/components/ui/label';
import { CalendarIcon, Download, FileSpreadsheet } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import * as XLSX from 'xlsx';

interface ExportDialogProps {
  competitionFilter?: string;
}

interface ExportData {
  fixtures: any[];
  goalScorers: any[];
  assisters: any[];
}

export function ExportDialog({ competitionFilter = 'all' }: ExportDialogProps) {
  const [open, setOpen] = useState(false);
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [isExporting, setIsExporting] = useState(false);
  const { toast } = useToast();

  const fetchExportData = async (start: Date, end: Date): Promise<ExportData> => {
    // Build competition filter condition
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

    // Fetch fixtures with all related data in date range
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
        teams!fk_fixtures_team_id (name),
        match_events (
          id,
          event_type,
          minute,
          half,
          is_our_team,
          is_penalty,
          player_id,
          players!fk_match_events_player_id (first_name, last_name)
        )
      `)
      .gte('scheduled_date', start.toISOString())
      .lte('scheduled_date', end.toISOString())
      .match(competitionCondition)
      .order('scheduled_date', { ascending: true });

    if (fixturesError) throw fixturesError;

    // Process fixtures data
    const processedFixtures = (fixtures || []).map(fixture => {
      const ourGoals = fixture.match_events?.filter(e => 
        e.event_type === 'goal' && e.is_our_team
      ).length || 0;
      
      const opponentGoals = fixture.match_events?.filter(e => 
        e.event_type === 'goal' && !e.is_our_team
      ).length || 0;

      return {
        Date: format(new Date(fixture.scheduled_date), 'dd/MM/yyyy'),
        Time: format(new Date(fixture.scheduled_date), 'HH:mm'),
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

    // Process goal scorers
    const goalScorersMap = new Map<string, any>();
    const assistersMap = new Map<string, any>();

    (fixtures || []).forEach(fixture => {
      const teamName = fixture.teams?.name || 'Unknown';
      
      fixture.match_events?.forEach(event => {
        if (!event.player_id || !event.players || !event.is_our_team) return;
        
        const playerId = event.player_id;
        const playerName = `${event.players.first_name} ${event.players.last_name}`;
        
        if (event.event_type === 'goal') {
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

    const goalScorers = Array.from(goalScorersMap.values())
      .sort((a, b) => b.Goals - a.Goals);

    const assisters = Array.from(assistersMap.values())
      .sort((a, b) => b.Assists - a.Assists);

    return {
      fixtures: processedFixtures,
      goalScorers,
      assisters
    };
  };

  const handleExport = async () => {
    if (!startDate || !endDate) {
      toast({
        title: "Date Range Required",
        description: "Please select both start and end dates",
        variant: "destructive",
      });
      return;
    }

    if (startDate > endDate) {
      toast({
        title: "Invalid Date Range",
        description: "Start date must be before end date",
        variant: "destructive",
      });
      return;
    }

    setIsExporting(true);

    try {
      const data = await fetchExportData(startDate, endDate);

      // Create workbook
      const workbook = XLSX.utils.book_new();

      // Add Fixtures sheet
      const fixturesSheet = XLSX.utils.json_to_sheet(data.fixtures);
      XLSX.utils.book_append_sheet(workbook, fixturesSheet, 'Fixtures & Results');

      // Add Goal Scorers sheet
      const goalScorersSheet = XLSX.utils.json_to_sheet(data.goalScorers);
      XLSX.utils.book_append_sheet(workbook, goalScorersSheet, 'Goal Scorers');

      // Add Assists sheet
      const assistsSheet = XLSX.utils.json_to_sheet(data.assisters);
      XLSX.utils.book_append_sheet(workbook, assistsSheet, 'Assists');

      // Generate filename
      const startDateStr = format(startDate, 'yyyy-MM-dd');
      const endDateStr = format(endDate, 'yyyy-MM-dd');
      const competitionStr = competitionFilter === 'all' ? 'All' : 
        competitionFilter.replace('type:', '').replace('name:', '').replace(/:/g, '-');
      const filename = `Match_Report_${startDateStr}_to_${endDateStr}_${competitionStr}.xlsx`;

      // Download file
      XLSX.writeFile(workbook, filename);

      toast({
        title: "Export Successful",
        description: `Data exported to ${filename}`,
      });

      setOpen(false);
    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: "Export Failed",
        description: "There was an error exporting the data",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <FileSpreadsheet className="h-4 w-4" />
          Export Data
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Export Match Data
          </DialogTitle>
          <DialogDescription>
            Select a date range to export fixtures, results, goal scorers, and assists data to Excel.
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start-date">Start Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    id="start-date"
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !startDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, "PPP") : "Pick start date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={setStartDate}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="end-date">End Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    id="end-date"
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !endDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, "PPP") : "Pick end date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={setEndDate}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Export Will Include:</Label>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Fixtures and Results (with scores, dates, opponents)</li>
              <li>• Goal Scorers Tally (including penalty goals)</li>
              <li>• Assists Table</li>
              <li>• Competition and match details</li>
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleExport} 
            disabled={isExporting || !startDate || !endDate}
            className="gap-2"
          >
            {isExporting ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                Export Excel
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}