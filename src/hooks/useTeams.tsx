import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Club {
  id: string;
  name: string;
}

interface Team {
  id: string;
  name: string;
  team_type: string;
  club_id: string;
  created_at: string;
  club: Club;
  _count?: {
    team_players: number;
  };
}

interface CreateTeamData {
  name: string;
  team_type: '5-a-side' | '7-a-side' | '9-a-side' | '11-a-side';
  club_id: string;
}

interface UpdateTeamData {
  name?: string;
  team_type?: '5-a-side' | '7-a-side' | '9-a-side' | '11-a-side';
}

// Fetch all teams with player counts
export function useTeams() {
  return useQuery({
    queryKey: ['teams'],
    queryFn: async (): Promise<Team[]> => {
      const { data, error } = await supabase
        .from('teams_with_stats')
        .select(`
          id,
          name,
          team_type,
          club_id,
          created_at,
          club_name,
          player_count
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Transform data from teams_with_stats view to match expected format
      return (data || []).map(team => ({
        id: team.id,
        name: team.name,
        team_type: team.team_type,
        club_id: team.club_id,
        created_at: team.created_at,
        club: { id: team.club_id, name: (team as any).club_name || '' },
        _count: {
          team_players: typeof (team as any).player_count === 'number'
            ? Number((team as any).player_count)
            : parseInt(((team as any).player_count ?? '0') as string, 10)
        }
      }));
    },
    staleTime: 5 * 60 * 1000, // Consider fresh for 5 minutes
    gcTime: 10 * 60 * 1000,   // Keep in cache for 10 minutes
  });
}

// Create a new team
export function useCreateTeam() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (teamData: CreateTeamData) => {
      const { data, error } = await supabase
        .from('teams')
        .insert([teamData])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onMutate: async (newTeam) => {
      await queryClient.cancelQueries({ queryKey: ['teams'] });
      
      const previousTeams = queryClient.getQueryData(['teams']);
      
      queryClient.setQueryData(['teams'], (old: Team[] | undefined) => {
        const tempTeam: Team = {
          id: `temp-${Date.now()}`,
          ...newTeam,
          created_at: new Date().toISOString(),
          club: { id: newTeam.club_id, name: 'Loading...' },
          _count: { team_players: 0 }
        };
        return [tempTeam, ...(old || [])];
      });
      
      return { previousTeams };
    },
    onError: (error: any, newTeam, context) => {
      if (context?.previousTeams) {
        queryClient.setQueryData(['teams'], context.previousTeams);
      }
      toast({
        title: "Error",
        description: error.message || "Failed to create team",
        variant: "destructive",
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Team created successfully",
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    },
  });
}

// Update a team
export function useUpdateTeam() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateTeamData }) => {
      const { data: updatedTeam, error } = await supabase
        .from('teams')
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return updatedTeam;
    },
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: ['teams'] });
      
      const previousTeams = queryClient.getQueryData(['teams']);
      
      queryClient.setQueryData(['teams'], (old: Team[] | undefined) => 
        (old || []).map(team => 
          team.id === id ? { ...team, ...data } : team
        )
      );
      
      return { previousTeams };
    },
    onError: (error: any, variables, context) => {
      if (context?.previousTeams) {
        queryClient.setQueryData(['teams'], context.previousTeams);
      }
      toast({
        title: "Error",
        description: error.message || "Failed to update team",
        variant: "destructive",
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Team updated successfully",
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    },
  });
}

// Delete a team
export function useDeleteTeam() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('teams')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onMutate: async (deletedId) => {
      await queryClient.cancelQueries({ queryKey: ['teams'] });
      
      const previousTeams = queryClient.getQueryData(['teams']);
      
      queryClient.setQueryData(['teams'], (old: Team[] | undefined) => 
        (old || []).filter(team => team.id !== deletedId)
      );
      
      return { previousTeams };
    },
    onError: (error: any, variables, context) => {
      if (context?.previousTeams) {
        queryClient.setQueryData(['teams'], context.previousTeams);
      }
      toast({
        title: "Error",
        description: error.message || "Failed to delete team",
        variant: "destructive",
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Team deleted successfully",
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      queryClient.invalidateQueries({ queryKey: ['players'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      queryClient.invalidateQueries({ queryKey: ['fixtures'] });
    },
  });
}