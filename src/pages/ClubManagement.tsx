import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Building, Users, Edit, Trash } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Club {
  id: string;
  name: string;
  logo_url?: string;
  created_at: string;
  created_by: string;
  club_members: Array<{
    role: string;
    user_id: string;
  }>;
}

export default function ClubManagement() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [clubs, setClubs] = useState<Club[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newClubName, setNewClubName] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchClubs();
  }, [user]);

  const fetchClubs = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('clubs')
        .select(`
          id,
          name,
          logo_url,
          created_at,
          created_by,
          club_members!inner(
            role,
            user_id
          )
        `)
        .eq('club_members.user_id', user.id);

      if (error) throw error;
      setClubs(data || []);
    } catch (error) {
      console.error('Error fetching clubs:', error);
      toast({
        title: "Error",
        description: "Failed to load clubs",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const createClub = async () => {
    if (!user || !newClubName.trim()) return;

    setCreating(true);
    try {
      // Create club
      const { data: club, error: clubError } = await supabase
        .from('clubs')
        .insert({
          name: newClubName.trim(),
          created_by: user.id
        })
        .select()
        .single();

      if (clubError) throw clubError;

      // Add creator as admin member
      const { error: memberError } = await supabase
        .from('club_members')
        .insert({
          club_id: club.id,
          user_id: user.id,
          role: 'admin'
        });

      if (memberError) throw memberError;

      toast({
        title: "Success",
        description: "Club created successfully!",
      });

      setNewClubName('');
      setShowCreateDialog(false);
      fetchClubs();
    } catch (error: any) {
      console.error('Error creating club:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to create club",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3"></div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="h-48 bg-muted rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
        <div>
          <h1 className="text-3xl font-bold">Club Management</h1>
          <p className="text-muted-foreground">
            Create and manage your football clubs
          </p>
        </div>
        
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button className="touch-target">
              <Plus className="h-4 w-4 mr-2" />
              Create Club
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Club</DialogTitle>
              <DialogDescription>
                Set up a new football club. You'll be added as the administrator.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="clubName">Club Name</Label>
                <Input
                  id="clubName"
                  value={newClubName}
                  onChange={(e) => setNewClubName(e.target.value)}
                  placeholder="Enter club name"
                  className="touch-target"
                />
              </div>
              <div className="flex justify-end space-x-2">
                <Button
                  variant="outline"
                  onClick={() => setShowCreateDialog(false)}
                  disabled={creating}
                >
                  Cancel
                </Button>
                <Button
                  onClick={createClub}
                  disabled={creating || !newClubName.trim()}
                  className="touch-target"
                >
                  {creating ? 'Creating...' : 'Create Club'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Clubs Grid */}
      {clubs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Building className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No clubs yet</h3>
            <p className="text-muted-foreground mb-4">
              Create your first club to start managing teams and players.
            </p>
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Club
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {clubs.map((club) => (
            <Card key={club.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    {club.logo_url ? (
                      <img 
                        src={club.logo_url} 
                        alt={club.name}
                        className="h-12 w-12 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Building className="h-6 w-6 text-primary" />
                      </div>
                    )}
                    <div>
                      <CardTitle className="text-xl">{club.name}</CardTitle>
                      <CardDescription>
                        Created {new Date(club.created_at).toLocaleDateString()}
                      </CardDescription>
                    </div>
                  </div>
                  
                  <div className="flex space-x-2">
                    <Button variant="outline" size="sm">
                      <Edit className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-4">
                {/* Members */}
                <div>
                  <h4 className="font-medium mb-2 flex items-center">
                    <Users className="h-4 w-4 mr-2" />
                    Members ({club.club_members.length})
                  </h4>
                  <div className="space-y-2">
                    {club.club_members.slice(0, 3).map((member, index) => (
                      <div key={index} className="flex items-center justify-between text-sm">
                        <span>
                          Member {index + 1}
                        </span>
                        <Badge variant={member.role === 'admin' ? 'default' : 'secondary'}>
                          {member.role}
                        </Badge>
                      </div>
                    ))}
                    {club.club_members.length > 3 && (
                      <p className="text-xs text-muted-foreground">
                        +{club.club_members.length - 3} more
                      </p>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex space-x-2 pt-2">
                  <Button variant="outline" size="sm" className="flex-1">
                    <Users className="h-4 w-4 mr-2" />
                    Manage Teams
                  </Button>
                  <Button variant="outline" size="sm" className="flex-1">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Members
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}