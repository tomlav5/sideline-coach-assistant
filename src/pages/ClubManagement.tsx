import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Users, Plus, Calendar, User, Crown, Shield, Eye } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { UserManagement } from '@/components/club/UserManagement';
import { LogoUpload } from '@/components/club/LogoUpload';

interface Club {
  id: string;
  name: string;
  logo_url?: string | null;
  created_at: string;
  created_by: string;
  members: Array<{
    id: string;
    role: 'admin' | 'official' | 'viewer';
    user_id: string;
  }>;
  currentUserRole?: string;
}

export default function ClubManagement() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [clubs, setClubs] = useState<Club[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newClubName, setNewClubName] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (user) {
      fetchClubs();
    }
  }, [user]);

  const fetchClubs = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('clubs')
        .select(`
          *,
          club_members(
            id,
            role,
            user_id
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Add current user role to each club
      const clubsWithRole = (data || []).map(club => {
        const currentUserMember = club.club_members.find(
          member => member.user_id === user?.id
        );
        return {
          ...club,
          members: club.club_members,
          currentUserRole: currentUserMember?.role
        };
      });

      setClubs(clubsWithRole);
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
    console.log('Creating club - User:', user);
    console.log('Creating club - User ID:', user?.id);
    
    if (!user) {
      toast({
        title: "Authentication Required", 
        description: "Please log in to create a club",
        variant: "destructive",
      });
      return;
    }

    if (!newClubName.trim()) {
      toast({
        title: "Error",
        description: "Please enter a club name",
        variant: "destructive",
      });
      return;
    }

    try {
      setCreating(true);
      
      console.log('About to create club with user ID:', user.id);
      
      // Create the club with explicit user ID
      const { data: clubData, error: clubError } = await supabase
        .from('clubs')
        .insert({
          name: newClubName.trim(),
          created_by: user.id,
        })
        .select()
        .single();

      if (clubError) {
        console.error('Club creation error:', clubError);
        throw clubError;
      }

      toast({
        title: "Success",
        description: "Club created successfully",
      });

      setCreateDialogOpen(false);
      setNewClubName('');
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

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin': return Crown;
      case 'official': return Shield;
      case 'viewer': return Eye;
      default: return User;
    }
  };

  const updateClubLogo = (clubId: string, logoUrl: string | null) => {
    setClubs(clubs.map(club => 
      club.id === clubId ? { ...club, logo_url: logoUrl } : club
    ));
  };

  if (loading) {
    return (
      <div className="container mx-auto p-4 space-y-6">
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 space-y-6 max-w-7xl">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="w-full sm:w-auto">
          <h1 className="text-2xl font-bold text-foreground">Club Management</h1>
          <p className="text-muted-foreground">Manage your football clubs and their settings</p>
        </div>
        
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
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
                Enter a name for your new football club
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Club Name</Label>
                <Input
                  id="name"
                  value={newClubName}
                  onChange={(e) => setNewClubName(e.target.value)}
                  placeholder="Enter club name"
                />
              </div>
              <div className="flex gap-2 pt-4">
                <Button onClick={createClub} disabled={creating} className="flex-1">
                  {creating ? "Creating..." : "Create Club"}
                </Button>
                <Button variant="outline" onClick={() => setCreateDialogOpen(false)} className="flex-1">
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {clubs.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No clubs yet</h3>
            <p className="text-muted-foreground text-center mb-4">
              Create your first club to start managing teams and players
            </p>
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Club
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:gap-6 xl:grid-cols-2">
          {clubs.map((club) => {
            const userRole = club.currentUserRole || 'viewer';
            const RoleIcon = getRoleIcon(userRole);
            
            return (
              <div key={club.id} className="space-y-4 sm:space-y-6 w-full min-w-0">
                <Card className="hover:shadow-md transition-shadow w-full">
                  <CardHeader className="pb-4">
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
                      <div className="flex items-center space-x-3 min-w-0 flex-1">
                        {club.logo_url ? (
                          <img
                            src={club.logo_url}
                            alt={`${club.name} logo`}
                            className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg object-cover border flex-shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg border border-dashed border-muted-foreground flex items-center justify-center flex-shrink-0">
                            <Users className="h-5 w-5 sm:h-6 sm:w-6 text-muted-foreground" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <CardTitle className="text-lg sm:text-xl truncate">{club.name}</CardTitle>
                          <CardDescription className="text-sm">
                            Created {new Date(club.created_at).toLocaleDateString()}
                          </CardDescription>
                        </div>
                      </div>
                      <Badge variant="secondary" className="flex items-center gap-1 self-start shrink-0">
                        <RoleIcon className="h-3 w-3" />
                        <span className="text-xs">{userRole}</span>
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div className="flex items-center text-sm text-muted-foreground">
                        <Users className="h-4 w-4 mr-1 flex-shrink-0" />
                        <span>{club.members.length} members</span>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                        <Button 
                          size="sm" 
                          variant="outline" 
                          onClick={() => window.location.href = '/teams'}
                          className="flex-1 sm:flex-none min-h-[36px]"
                        >
                          <Users className="h-4 w-4 mr-1" />
                          <span>Teams</span>
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          onClick={() => window.location.href = '/fixtures'}
                          className="flex-1 sm:flex-none min-h-[36px]"
                        >
                          <Calendar className="h-4 w-4 mr-1" />
                          <span>Fixtures</span>
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Logo Upload - Only for Admins */}
                {userRole === 'admin' && (
                  <div className="w-full">
                    <LogoUpload
                      clubId={club.id}
                      currentLogoUrl={club.logo_url}
                      onLogoUpdate={(logoUrl) => updateClubLogo(club.id, logoUrl)}
                    />
                  </div>
                )}

                {/* User Management - Only for Admins */}
                {userRole === 'admin' && (
                  <div className="w-full">
                    <UserManagement 
                      clubId={club.id} 
                      currentUserRole={userRole}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}