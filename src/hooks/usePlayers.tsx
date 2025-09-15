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
}

interface Player {
  id: string;
  first_name: string;
  last_name: string;
  jersey_number: number | null;
  club_id: string;
  created_at: string;
  club: Club;
  teams?: Team[];
}

interface CreatePlayerData {
  first_name: string;
  last_name: string;
  jersey_number?: number | null;
  club_id: string;
}

interface UpdatePlayerData {
  first_name?: string;
  last_name?: string;
  jersey_number?: number | null;
}

// Fetch all players with their teams and clubs
export function usePlayers() {
  return useQuery({
    queryKey: ['players'],
    queryFn: async (): Promise<Player[]> => {
      const { data, error } = await supabase
        .from('players_with_teams')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Transform data to match expected format
      return (data || []).map(player => ({
        id: player.id,
        first_name: player.first_name,
        last_name: player.last_name,
        jersey_number: player.jersey_number,
        club_id: player.club_id,
        created_at: player.created_at,
        club: { id: player.club_id, name: player.club_name || '' },
        teams: Array.isArray(player.teams) ? player.teams.map((team: any) => ({
          id: team.id,
          name: team.name,
          team_type: team.team_type,
          club_id: team.club_id
        })) : []
      }));
    },
    staleTime: 5 * 60 * 1000, // Consider fresh for 5 minutes
    gcTime: 10 * 60 * 1000,   // Keep in cache for 10 minutes
  });
}

// Create a new player
export function useCreatePlayer() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (playerData: CreatePlayerData) => {
      const { data, error } = await supabase
        .from('players')
        .insert([playerData])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onMutate: async (newPlayer) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['players'] });
      
      // Snapshot current data
      const previousPlayers = queryClient.getQueryData(['players']);
      
      // Optimistically update UI immediately
      queryClient.setQueryData(['players'], (old: Player[] | undefined) => {
        const tempPlayer: Player = {
          id: `temp-${Date.now()}`,
          first_name: newPlayer.first_name,
          last_name: newPlayer.last_name,
          jersey_number: newPlayer.jersey_number || null,
          club_id: newPlayer.club_id,
          created_at: new Date().toISOString(),
          club: { id: newPlayer.club_id, name: 'Loading...' },
          teams: []
        };
        return [tempPlayer, ...(old || [])];
      });
      
      return { previousPlayers };
    },
    onError: (error: any, newPlayer, context) => {
      // Rollback on error
      if (context?.previousPlayers) {
        queryClient.setQueryData(['players'], context.previousPlayers);
      }
      toast({
        title: "Error",
        description: error.message || "Failed to create player",
        variant: "destructive",
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Player created successfully",
      });
    },
    onSettled: () => {
      // Refetch to ensure consistency
      queryClient.invalidateQueries({ queryKey: ['players'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      queryClient.invalidateQueries({ queryKey: ['teams'] });
    },
  });
}

// Update a player
export function useUpdatePlayer() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdatePlayerData }) => {
      const { data: updatedPlayer, error } = await supabase
        .from('players')
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return updatedPlayer;
    },
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: ['players'] });
      
      const previousPlayers = queryClient.getQueryData(['players']);
      
      queryClient.setQueryData(['players'], (old: Player[] | undefined) => 
        (old || []).map(player => 
          player.id === id ? { ...player, ...data } : player
        )
      );
      
      return { previousPlayers };
    },
    onError: (error: any, variables, context) => {
      if (context?.previousPlayers) {
        queryClient.setQueryData(['players'], context.previousPlayers);
      }
      toast({
        title: "Error",
        description: error.message || "Failed to update player",
        variant: "destructive",
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Player updated successfully",
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['players'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    },
  });
}

// Delete a player
export function useDeletePlayer() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('players')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onMutate: async (deletedId) => {
      await queryClient.cancelQueries({ queryKey: ['players'] });
      
      const previousPlayers = queryClient.getQueryData(['players']);
      
      queryClient.setQueryData(['players'], (old: Player[] | undefined) => 
        (old || []).filter(player => player.id !== deletedId)
      );
      
      return { previousPlayers };
    },
    onError: (error: any, variables, context) => {
      if (context?.previousPlayers) {
        queryClient.setQueryData(['players'], context.previousPlayers);
      }
      toast({
        title: "Error",
        description: error.message || "Failed to delete player",
        variant: "destructive",
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Player deleted successfully",
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['players'] });
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    },
  });
}