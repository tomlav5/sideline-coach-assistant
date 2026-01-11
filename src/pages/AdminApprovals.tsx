import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Shield, Clock, CheckCircle2, XCircle, Chrome, Mail, Users } from 'lucide-react';
import { format } from 'date-fns';

interface PendingRegistration {
  id: string;
  user_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  oauth_provider: string | null;
  status: string;
  created_at: string;
}

interface PendingOfficial {
  id: string;
  club_id: string;
  user_id: string;
  role: string;
  status: string;
  invited_at: string | null;
  clubs: {
    name: string;
  };
  profiles: {
    first_name: string | null;
    last_name: string | null;
    email: string | null;
  };
}

export default function AdminApprovals() {
  const { toast } = useToast();
  const [pendingRegistrations, setPendingRegistrations] = useState<PendingRegistration[]>([]);
  const [pendingOfficials, setPendingOfficials] = useState<PendingOfficial[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  useEffect(() => {
    fetchPendingApprovals();
  }, []);

  const fetchPendingApprovals = async () => {
    try {
      setLoading(true);

      // Fetch pending registrations
      const { data: registrations, error: regError } = await supabase
        .from('pending_registrations')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (regError) throw regError;

      // Fetch pending club officials
      const { data: officials, error: offError } = await supabase
        .from('club_members')
        .select(`
          id,
          club_id,
          user_id,
          role,
          status,
          invited_at,
          clubs (name),
          profiles (first_name, last_name, email)
        `)
        .eq('status', 'pending')
        .eq('role', 'official')
        .order('invited_at', { ascending: false });

      if (offError) throw offError;

      setPendingRegistrations(registrations || []);
      setPendingOfficials(officials as any || []);
    } catch (error: any) {
      console.error('Error fetching approvals:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to load pending approvals',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const approveRegistration = async (registrationId: string) => {
    try {
      setProcessingId(registrationId);

      const { data, error } = await supabase.rpc('approve_user_registration', {
        registration_id: registrationId,
        approver_id: (await supabase.auth.getUser()).data.user?.id,
      });

      if (error) throw error;

      if (!data.success) {
        throw new Error(data.error || 'Failed to approve registration');
      }

      toast({
        title: 'Registration Approved',
        description: 'User can now access the application',
      });

      fetchPendingApprovals();
    } catch (error: any) {
      console.error('Error approving registration:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to approve registration',
        variant: 'destructive',
      });
    } finally {
      setProcessingId(null);
    }
  };

  const rejectRegistration = async (registrationId: string, reason: string) => {
    try {
      setProcessingId(registrationId);

      const { data, error } = await supabase.rpc('reject_user_registration', {
        registration_id: registrationId,
        approver_id: (await supabase.auth.getUser()).data.user?.id,
        reason: reason || null,
      });

      if (error) throw error;

      if (!data.success) {
        throw new Error(data.error || 'Failed to reject registration');
      }

      toast({
        title: 'Registration Rejected',
        description: 'User has been notified',
      });

      setRejectionReason('');
      fetchPendingApprovals();
    } catch (error: any) {
      console.error('Error rejecting registration:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to reject registration',
        variant: 'destructive',
      });
    } finally {
      setProcessingId(null);
    }
  };

  const approveOfficial = async (memberId: string) => {
    try {
      setProcessingId(memberId);

      const { error } = await supabase
        .from('club_members')
        .update({ 
          status: 'active',
          approved_at: new Date().toISOString(),
        })
        .eq('id', memberId);

      if (error) throw error;

      toast({
        title: 'Official Approved',
        description: 'User can now access the club',
      });

      fetchPendingApprovals();
    } catch (error: any) {
      console.error('Error approving official:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to approve official',
        variant: 'destructive',
      });
    } finally {
      setProcessingId(null);
    }
  };

  const rejectOfficial = async (memberId: string) => {
    try {
      setProcessingId(memberId);

      const { error } = await supabase
        .from('club_members')
        .update({ status: 'rejected' })
        .eq('id', memberId);

      if (error) throw error;

      toast({
        title: 'Official Rejected',
        description: 'User has been notified',
      });

      fetchPendingApprovals();
    } catch (error: any) {
      console.error('Error rejecting official:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to reject official',
        variant: 'destructive',
      });
    } finally {
      setProcessingId(null);
    }
  };

  const getProviderIcon = (provider: string | null) => {
    switch (provider) {
      case 'google':
        return <Chrome className="h-4 w-4" />;
      case 'apple':
        return <Shield className="h-4 w-4" />;
      case 'email':
      default:
        return <Mail className="h-4 w-4" />;
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center">
          <div className="animate-pulse">Loading approvals...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Shield className="h-8 w-8 text-primary" />
            Admin Approvals
          </h1>
          <p className="text-muted-foreground">Review and approve pending registrations</p>
        </div>
        <Button onClick={fetchPendingApprovals} variant="outline" size="sm">
          Refresh
        </Button>
      </div>

      <Tabs defaultValue="registrations" className="space-y-6">
        <TabsList>
          <TabsTrigger value="registrations" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            New Registrations
            {pendingRegistrations.length > 0 && (
              <Badge variant="secondary">{pendingRegistrations.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="officials" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Club Officials
            {pendingOfficials.length > 0 && (
              <Badge variant="secondary">{pendingOfficials.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="registrations">
          <Card>
            <CardHeader>
              <CardTitle>Pending User Registrations</CardTitle>
              <CardDescription>
                New users waiting for account approval
              </CardDescription>
            </CardHeader>
            <CardContent>
              {pendingRegistrations.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <CheckCircle2 className="h-12 w-12 mx-auto mb-3 text-green-600" />
                  <p>No pending registrations</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Provider</TableHead>
                      <TableHead>Registered</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingRegistrations.map((reg) => (
                      <TableRow key={reg.id}>
                        <TableCell className="font-medium">
                          {reg.first_name && reg.last_name
                            ? `${reg.first_name} ${reg.last_name}`
                            : 'No name provided'}
                        </TableCell>
                        <TableCell>{reg.email}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getProviderIcon(reg.oauth_provider)}
                            <span className="capitalize text-sm">
                              {reg.oauth_provider || 'email'}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {format(new Date(reg.created_at), 'MMM d, yyyy')}
                          <br />
                          <span className="text-xs">
                            {format(new Date(reg.created_at), 'h:mm a')}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              size="sm"
                              onClick={() => approveRegistration(reg.id)}
                              disabled={processingId === reg.id}
                            >
                              <CheckCircle2 className="h-4 w-4 mr-1" />
                              Approve
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  disabled={processingId === reg.id}
                                >
                                  <XCircle className="h-4 w-4 mr-1" />
                                  Reject
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Reject Registration</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to reject this registration?
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <div className="space-y-4 py-4">
                                  <div className="space-y-2">
                                    <Label htmlFor="reason">Reason (optional)</Label>
                                    <Textarea
                                      id="reason"
                                      placeholder="Provide a reason for rejection..."
                                      value={rejectionReason}
                                      onChange={(e) => setRejectionReason(e.target.value)}
                                      rows={3}
                                    />
                                  </div>
                                </div>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => rejectRegistration(reg.id, rejectionReason)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Reject Registration
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="officials">
          <Card>
            <CardHeader>
              <CardTitle>Pending Club Officials</CardTitle>
              <CardDescription>
                Officials requesting access to clubs
              </CardDescription>
            </CardHeader>
            <CardContent>
              {pendingOfficials.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <CheckCircle2 className="h-12 w-12 mx-auto mb-3 text-green-600" />
                  <p>No pending official requests</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Official</TableHead>
                      <TableHead>Club</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Requested</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingOfficials.map((official) => (
                      <TableRow key={official.id}>
                        <TableCell className="font-medium">
                          {official.profiles?.first_name && official.profiles?.last_name
                            ? `${official.profiles.first_name} ${official.profiles.last_name}`
                            : official.profiles?.email || 'Unknown'}
                        </TableCell>
                        <TableCell>{official.clubs?.name || 'Unknown Club'}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {official.role}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {official.invited_at
                            ? format(new Date(official.invited_at), 'MMM d, yyyy')
                            : 'N/A'}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              size="sm"
                              onClick={() => approveOfficial(official.id)}
                              disabled={processingId === official.id}
                            >
                              <CheckCircle2 className="h-4 w-4 mr-1" />
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => rejectOfficial(official.id)}
                              disabled={processingId === official.id}
                            >
                              <XCircle className="h-4 w-4 mr-1" />
                              Reject
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
