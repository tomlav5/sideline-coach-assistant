import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

interface Club {
  id: string;
  name: string;
  logo_url?: string;
  created_at: string;
}

interface CreateClubData {
  name: string;
  logo_url?: string;
}

interface UpdateClubData {
  name?: string;
  logo_url?: string;
}

// Fetch clubs user has access to
export function useClubs() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['clubs', user?.id],
    queryFn: async (): Promise<Club[]> => {
      const { data, error } = await supabase
        .from('clubs')
        .select(`
          id,
          name,
          logo_url,
          created_at,
          club_members!inner(role)
        `)
        .eq('club_members.user_id', user.id);

      if (error) throw error;
      
      return (data || []).map(club => ({
        id: club.id,
        name: club.name,
        logo_url: club.logo_url,
        created_at: club.created_at
      }));
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // Consider fresh for 5 minutes
    gcTime: 10 * 60 * 1000,   // Keep in cache for 10 minutes
  });
}

// Create a new club
export function useCreateClub() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (clubData: CreateClubData) => {
      const { data, error } = await supabase
        .from('clubs')
        .insert([{ ...clubData, created_by: user?.id }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onMutate: async (newClub) => {
      await queryClient.cancelQueries({ queryKey: ['clubs'] });
      
      const previousClubs = queryClient.getQueryData(['clubs']);
      
      queryClient.setQueryData(['clubs'], (old: Club[] | undefined) => {
        const tempClub: Club = {
          id: `temp-${Date.now()}`,
          ...newClub,
          created_at: new Date().toISOString()
        };
        return [tempClub, ...(old || [])];
      });
      
      return { previousClubs };
    },
    onError: (error: any, newClub, context) => {
      if (context?.previousClubs) {
        queryClient.setQueryData(['clubs'], context.previousClubs);
      }
      toast({
        title: "Error",
        description: error.message || "Failed to create club",
        variant: "destructive",
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Club created successfully",
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['clubs'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    },
  });
}

// Update a club
export function useUpdateClub() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateClubData }) => {
      const { data: updatedClub, error } = await supabase
        .from('clubs')
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return updatedClub;
    },
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: ['clubs'] });
      
      const previousClubs = queryClient.getQueryData(['clubs']);
      
      queryClient.setQueryData(['clubs'], (old: Club[] | undefined) => 
        (old || []).map(club => 
          club.id === id ? { ...club, ...data } : club
        )
      );
      
      return { previousClubs };
    },
    onError: (error: any, variables, context) => {
      if (context?.previousClubs) {
        queryClient.setQueryData(['clubs'], context.previousClubs);
      }
      toast({
        title: "Error",
        description: error.message || "Failed to update club",
        variant: "destructive",
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Club updated successfully",
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['clubs'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    },
  });
}