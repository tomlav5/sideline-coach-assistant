import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Fixture {
  id: string;
  scheduled_date: string;
  opponent_name: string;
  location: string | null;
  fixture_type: 'home' | 'away';
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  half_length: number;
  team_id: string;
  team: {
    id: string;
    name: string;
    club: {
      id: string;
      name: string;
    };
  };
  created_at: string;
  competition_type: 'league' | 'tournament' | 'friendly';
  competition_name: string | null;
  selected_squad_data: any;
}

export function useFixtures() {
  return useQuery({
    queryKey: ['fixtures'],
    queryFn: async () => {
      const { data, error } = await supabase
        .rpc('get_fixtures_with_scores_secure');

      if (error) throw error;
      
      // Transform to expected format
      return (data || []).map(fixture => ({
        id: fixture.id,
        scheduled_date: fixture.scheduled_date,
        opponent_name: fixture.opponent_name,
        location: fixture.location,
        fixture_type: fixture.fixture_type,
        status: fixture.status,
        half_length: fixture.half_length,
        team_id: fixture.team_id,
        team: {
          id: fixture.team_id,
          name: fixture.team_name || '',
          club: {
            id: '', // Not available in view but not critical for display
            name: fixture.club_name || ''
          }
        },
        created_at: fixture.created_at,
        competition_type: fixture.competition_type,
        competition_name: fixture.competition_name,
        selected_squad_data: fixture.selected_squad_data,
        match_status: fixture.match_status
      })) as unknown as Fixture[];
    }
  });
}

export function useCreateFixture() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (fixtureData: any) => {
      const { error } = await supabase
        .from('fixtures')
        .insert([fixtureData]);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fixtures'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      toast({
        title: "Success",
        description: "Fixture created successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  });
}

export function useUpdateFixture() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const { error } = await supabase
        .from('fixtures')
        .update(data)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fixtures'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      toast({
        title: "Success",
        description: "Fixture updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  });
}

export function useDeleteFixture() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('fixtures')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fixtures'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      queryClient.invalidateQueries({ queryKey: ['live-match-detection'] });
      queryClient.invalidateQueries({ queryKey: ['live-match-check'] });
      toast({
        title: "Success",
        description: "Fixture deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  });
}