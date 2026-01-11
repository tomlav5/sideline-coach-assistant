import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Shield, CheckCircle2, Clock, AlertCircle, Users } from 'lucide-react';

interface InvitationDetails {
  id: string;
  club_id: string;
  invited_role: 'admin' | 'official' | 'viewer';
  invited_by: string;
  status: string;
  expires_at: string;
  clubs: {
    name: string;
  };
  inviter: {
    first_name: string | null;
    last_name: string | null;
  };
}

export default function AcceptInvitation() {
  const { token } = useParams<{ token: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [invitation, setInvitation] = useState<InvitationDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (token) {
      fetchInvitationDetails();
    } else {
      setError('Invalid invitation link');
      setLoading(false);
    }
  }, [token]);

  const fetchInvitationDetails = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('club_invitations')
        .select(`
          id,
          club_id,
          invited_role,
          invited_by,
          status,
          expires_at,
          clubs (name),
          inviter:profiles!club_invitations_invited_by_fkey (first_name, last_name)
        `)
        .eq('invitation_token', token)
        .single();

      if (error) throw error;

      if (!data) {
        throw new Error('Invitation not found');
      }

      // Check if expired
      if (new Date(data.expires_at) < new Date()) {
        throw new Error('This invitation has expired');
      }

      // Check if already used
      if (data.status !== 'pending') {
        throw new Error('This invitation has already been used');
      }

      setInvitation(data as any);
    } catch (error: any) {
      console.error('Error fetching invitation:', error);
      setError(error.message || 'Failed to load invitation');
    } finally {
      setLoading(false);
    }
  };

  const acceptInvitation = async () => {
    if (!user || !token) {
      navigate('/auth?redirect=/invite/' + token);
      return;
    }

    try {
      setAccepting(true);

      const { data, error } = await supabase.rpc('accept_club_invitation', {
        p_token: token,
        p_user_id: user.id,
      });

      if (error) throw error;

      if (!data.success) {
        throw new Error(data.error || 'Failed to accept invitation');
      }

      // Show success message
      const needsApproval = data.needs_approval;
      
      toast({
        title: needsApproval ? 'Invitation Accepted - Pending Approval' : 'Invitation Accepted',
        description: needsApproval 
          ? 'Your request to join as an official is pending approval from the club admin'
          : 'You have successfully joined the club',
      });

      // Redirect based on approval status
      if (needsApproval) {
        navigate('/pending-approval');
      } else {
        navigate('/club-management');
      }
    } catch (error: any) {
      console.error('Error accepting invitation:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to accept invitation',
        variant: 'destructive',
      });
    } finally {
      setAccepting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="animate-pulse text-muted-foreground">Loading invitation...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center space-y-2">
            <div className="flex items-center justify-center space-x-2">
              <Shield className="h-8 w-8 text-destructive" />
              <h1 className="text-3xl font-bold">SideLine</h1>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-center text-destructive flex items-center justify-center gap-2">
                <AlertCircle className="h-5 w-5" />
                Invalid Invitation
              </CardTitle>
              <CardDescription className="text-center">
                This invitation link is not valid
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="text-center space-y-4">
                <p className="text-sm text-muted-foreground">{error}</p>
                <Button onClick={() => navigate('/auth')} className="w-full">
                  Go to Sign In
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!invitation) {
    return null;
  }

  const inviterName = invitation.inviter?.first_name && invitation.inviter?.last_name
    ? `${invitation.inviter.first_name} ${invitation.inviter.last_name}`
    : 'A club administrator';

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center space-x-2">
            <Shield className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold text-primary">SideLine</h1>
          </div>
          <p className="text-muted-foreground">
            You've been invited to join a club
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-center">Club Invitation</CardTitle>
            <CardDescription className="text-center">
              {inviterName} has invited you to join
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-center">
                <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center">
                  <Users className="h-10 w-10 text-primary" />
                </div>
              </div>

              <div className="text-center space-y-2">
                <h3 className="text-xl font-semibold">{invitation.clubs.name}</h3>
                <Badge variant="secondary" className="capitalize">
                  {invitation.invited_role}
                </Badge>
              </div>

              <div className="space-y-3 pt-4 border-t">
                <div className="flex items-start gap-3 text-left">
                  <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Access Level</p>
                    <p className="text-xs text-muted-foreground">
                      {invitation.invited_role === 'admin' && 'Full administrative access to the club'}
                      {invitation.invited_role === 'official' && 'Create and manage teams, track matches'}
                      {invitation.invited_role === 'viewer' && 'View matches and team information'}
                    </p>
                  </div>
                </div>

                {invitation.invited_role === 'official' && (
                  <div className="flex items-start gap-3 text-left">
                    <Clock className="h-5 w-5 text-amber-500 mt-0.5 flex-shrink-0" />
                    <div className="space-y-1">
                      <p className="text-sm font-medium">Approval Required</p>
                      <p className="text-xs text-muted-foreground">
                        Your access will be reviewed by the club administrator
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-3">
              {!user ? (
                <div className="space-y-2">
                  <p className="text-xs text-center text-muted-foreground">
                    You need to sign in to accept this invitation
                  </p>
                  <Button 
                    onClick={() => navigate('/auth?redirect=/invite/' + token)} 
                    className="w-full"
                  >
                    Sign In to Accept
                  </Button>
                </div>
              ) : (
                <Button 
                  onClick={acceptInvitation} 
                  className="w-full"
                  disabled={accepting}
                >
                  {accepting ? 'Accepting...' : 'Accept Invitation'}
                </Button>
              )}
              
              <Button 
                onClick={() => navigate('/')} 
                variant="ghost" 
                size="sm"
                className="w-full"
                disabled={accepting}
              >
                Decline
              </Button>
            </div>

            <div className="pt-4 border-t">
              <p className="text-xs text-center text-muted-foreground">
                Expires: {new Date(invitation.expires_at).toLocaleDateString()}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
