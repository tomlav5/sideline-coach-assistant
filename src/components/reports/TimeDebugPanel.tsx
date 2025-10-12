import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

interface FixtureLite {
  id: string;
  scheduled_date: string | null;
  opponent_name: string | null;
  location: string | null;
  team_id: string;
  team: { name: string } | null;
}

interface PlayerLite {
  id: string;
  first_name: string;
  last_name: string;
}

interface PlayerTimeLogRow {
  id: string;
  fixture_id: string;
  player_id: string;
  period_id: string;
  period_number?: number | null; // Optional convenience if available via join
  total_period_minutes?: number | null;
  is_starter?: boolean | null;
  time_on_minute?: number | null;
  time_off_minute?: number | null;
}

function toCsv(rows: any[]): string {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const escape = (v: any) => {
    if (v === null || v === undefined) return '';
    const s = String(v).replace(/"/g, '""');
    return `"${s}"`;
  };
  const lines = [headers.map(escape).join(',')];
  for (const row of rows) {
    lines.push(headers.map((h) => escape(row[h])).join(','));
  }
  return lines.join('\n');
}

export function TimeDebugPanel() {
  const [fixtures, setFixtures] = useState<FixtureLite[]>([]);
  const [players, setPlayers] = useState<PlayerLite[]>([]);
  const [selectedFixtureId, setSelectedFixtureId] = useState<string>('');
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>('');
  const [logs, setLogs] = useState<PlayerTimeLogRow[]>([]);
  const [rpcRow, setRpcRow] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);

  // Load recent fixtures (limit 50)
  useEffect(() => {
    const loadFixtures = async () => {
      const { data, error } = await supabase
        .from('fixtures')
        .select('id, scheduled_date, opponent_name, location, team_id, teams(name)')
        .order('scheduled_date', { ascending: false })
        .limit(50);
      if (!error) {
        const mapped = (data || []).map((f: any) => ({
          id: f.id,
          scheduled_date: f.scheduled_date,
          opponent_name: f.opponent_name,
          location: f.location,
          team_id: f.team_id,
          team: f.teams ? { name: f.teams.name } : null,
        })) as FixtureLite[];
        setFixtures(mapped);
      }
    };
    loadFixtures();
  }, []);

  // Load players for the selected fixture's team (fallback to all players if no team)
  useEffect(() => {
    const loadPlayers = async () => {
      setPlayers([]);
      if (!selectedFixtureId) return;
      const fx = fixtures.find(f => f.id === selectedFixtureId);
      try {
        if (fx?.team_id) {
          const { data, error } = await supabase
            .from('team_players')
            .select('players(id, first_name, last_name)')
            .eq('team_id', fx.team_id);
          if (!error) {
            const list: PlayerLite[] = (data || [])
              .map((tp: any) => tp.players)
              .filter(Boolean)
              .map((p: any) => ({ id: p.id, first_name: p.first_name, last_name: p.last_name }));
            setPlayers(list);
          }
        } else {
          const { data } = await supabase
            .from('players')
            .select('id, first_name, last_name')
            .limit(100);
          setPlayers((data || []) as any);
        }
      } catch {
        // no-op
      }
    };
    loadPlayers();
  }, [selectedFixtureId, fixtures]);

  // Load logs + rpc for selection
  const refresh = async () => {
    if (!selectedFixtureId || !selectedPlayerId) return;
    setLoading(true);
    try {
      // player_time_logs with period data if available
      const { data: logRows } = await supabase
        .from('player_time_logs')
        .select('*')
        .eq('fixture_id', selectedFixtureId)
        .eq('player_id', selectedPlayerId)
        .order('period_id', { ascending: true });
      setLogs((logRows || []) as any);

      // v2 RPC totals
      const { data: rpcData } = await supabase.rpc('get_player_playing_time_v2' as any);
      const row = (Array.isArray(rpcData) ? rpcData : []).find((r: any) => r.player_id === selectedPlayerId) || null;
      setRpcRow(row);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Auto refresh when both selected
    if (selectedFixtureId && selectedPlayerId) {
      refresh();
    }
  }, [selectedFixtureId, selectedPlayerId]);

  // compute per-period and fixture totals
  const computed = useMemo(() => {
    const rows = logs || [];
    const enriched = rows.map((r) => {
      const isStarter = !!r.is_starter;
      const start = isStarter ? 0 : (r.time_on_minute ?? null);
      const cap = r.total_period_minutes ?? null;
      const endCandidate = r.time_off_minute ?? cap ?? null;
      const end = endCandidate !== null && cap !== null ? Math.min(endCandidate, cap) : endCandidate;
      const minutesInPeriod = start === null || end === null ? 0 : Math.max(0, end - start);
      return {
        ...r,
        minutes_in_period: minutesInPeriod,
        start_min: start,
        end_min: end,
      } as any;
    });
    const fixtureTotal = enriched.reduce((acc, r: any) => acc + (r.minutes_in_period || 0), 0);
    return { enriched, fixtureTotal };
  }, [logs]);

  const selectedFixture = fixtures.find(f => f.id === selectedFixtureId);
  const selectedPlayer = players.find(p => p.id === selectedPlayerId);

  const exportCsv = () => {
    const rows = (computed.enriched || []).map((r: any) => ({
      fixture_id: r.fixture_id,
      player_id: r.player_id,
      period_id: r.period_id,
      period_number: r.period_number ?? '',
      is_starter: r.is_starter ?? false,
      time_on_minute: r.time_on_minute ?? '',
      time_off_minute: r.time_off_minute ?? '',
      total_period_minutes: r.total_period_minutes ?? '',
      start_min: r.start_min ?? '',
      end_min: r.end_min ?? '',
      minutes_in_period: r.minutes_in_period ?? 0,
    }));
    const csv = toCsv(rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const fxName = selectedFixture?.team?.name || 'team';
    const plName = selectedPlayer ? `${selectedPlayer.first_name}_${selectedPlayer.last_name}` : 'player';
    a.download = `time_debug_${fxName}_${plName}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <Label>Fixture</Label>
          <Select value={selectedFixtureId} onValueChange={setSelectedFixtureId}>
            <SelectTrigger>
              <SelectValue placeholder="Select a fixture" />
            </SelectTrigger>
            <SelectContent>
              {fixtures.map((f) => (
                <SelectItem key={f.id} value={f.id}>
                  {f.team?.name || 'Team'} vs {f.opponent_name || 'Opponent'} • {f.scheduled_date ? format(new Date(f.scheduled_date), 'dd/MM HH:mm') : 'TBD'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Player</Label>
          <Select value={selectedPlayerId} onValueChange={setSelectedPlayerId}>
            <SelectTrigger>
              <SelectValue placeholder="Select a player" />
            </SelectTrigger>
            <SelectContent>
              {players.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.first_name} {p.last_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button onClick={refresh} disabled={!selectedFixtureId || !selectedPlayerId || loading}>
          {loading ? 'Loading...' : 'Refresh'}
        </Button>
        <Button variant="outline" onClick={exportCsv} disabled={!computed.enriched?.length}>Export CSV</Button>
      </div>

      {selectedPlayer && (
        <div className="text-sm text-muted-foreground">
          Selected: <span className="font-medium text-foreground">{selectedPlayer.first_name} {selectedPlayer.last_name}</span>
        </div>
      )}

      {/* Summary */}
      <div className="grid sm:grid-cols-3 gap-3">
        <div className="p-3 border rounded-lg">
          <div className="text-xs text-muted-foreground">Fixture total (computed)</div>
          <div className="text-lg font-semibold">{computed.fixtureTotal} min</div>
        </div>
        <div className="p-3 border rounded-lg">
          <div className="text-xs text-muted-foreground">RPC total (all matches)</div>
          <div className="text-lg font-semibold">{rpcRow?.total_minutes_played ?? 0} min</div>
        </div>
        <div className="p-3 border rounded-lg">
          <div className="text-xs text-muted-foreground">RPC avg per match</div>
          <div className="text-lg font-semibold">{rpcRow?.avg_minutes_per_match ?? 0} min</div>
        </div>
      </div>

      {/* Logs table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="py-2">Period</th>
              <th className="py-2">Starter</th>
              <th className="py-2">On</th>
              <th className="py-2">Off</th>
              <th className="py-2">Cap</th>
              <th className="py-2">Start</th>
              <th className="py-2">End</th>
              <th className="py-2 text-center">Minutes</th>
            </tr>
          </thead>
          <tbody>
            {(computed.enriched || []).map((r: any) => (
              <tr key={r.id} className="border-b">
                <td className="py-2">{r.period_number ?? r.period_id}</td>
                <td className="py-2">{r.is_starter ? 'Yes' : 'No'}</td>
                <td className="py-2">{r.time_on_minute ?? '-'}</td>
                <td className="py-2">{r.time_off_minute ?? '-'}</td>
                <td className="py-2">{r.total_period_minutes ?? '-'}</td>
                <td className="py-2">{r.start_min ?? '-'}</td>
                <td className="py-2">{r.end_min ?? '-'}</td>
                <td className="py-2 text-center">
                  <Badge variant="secondary">{r.minutes_in_period}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
