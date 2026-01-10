import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Clock, Mail, Shield, CheckCircle2 } from 'lucide-react';

export default function PendingApproval() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [accountStatus, setAccountStatus] = useState<string>('pending');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }

    checkAccountStatus();

    // Poll for status changes every 30 seconds
    const interval = setInterval(checkAccountStatus, 30000);
    return () => clearInterval(interval);
  }, [user, navigate]);

  const checkAccountStatus = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('profiles')
      .select('account_status')
      .eq('user_id', user.id)
      .single();

    if (error) {
      console.error('Error checking account status:', error);
      setLoading(false);
      return;
    }

    setAccountStatus(data?.account_status || 'pending');
    setLoading(false);

    // If approved, redirect to dashboard
    if (data?.account_status === 'approved') {
      navigate('/');
    }

    // If rejected, show rejection message
    if (data?.account_status === 'rejected') {
      // Status will be displayed in UI
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (accountStatus === 'rejected') {
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
              <CardTitle className="text-center text-destructive">Account Not Approved</CardTitle>
              <CardDescription className="text-center">
                Your registration request has been reviewed
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="text-center space-y-4">
                <p className="text-sm text-muted-foreground">
                  Unfortunately, your account registration was not approved at this time.
                  If you believe this is an error, please contact support.
                </p>
                <Button onClick={handleSignOut} variant="outline" className="w-full">
                  Back to Sign In
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center space-x-2">
            <Shield className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold text-primary">SideLine</h1>
          </div>
          <p className="text-muted-foreground">
            Football coaching made simple
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-center">Account Pending Approval</CardTitle>
            <CardDescription className="text-center">
              Your registration is being reviewed
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex justify-center">
              <div className="relative">
                <div className="h-24 w-24 rounded-full bg-primary/10 flex items-center justify-center">
                  <Clock className="h-12 w-12 text-primary animate-pulse" />
                </div>
              </div>
            </div>

            <div className="space-y-4 text-center">
              <h3 className="font-semibold text-lg">Thanks for signing up!</h3>
              <p className="text-sm text-muted-foreground">
                Your account is currently pending approval. We review all new registrations
                to ensure the quality and security of our community.
              </p>
              
              <div className="space-y-3 pt-4">
                <div className="flex items-start gap-3 text-left">
                  <Mail className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Email Confirmation</p>
                    <p className="text-xs text-muted-foreground">
                      Please verify your email if you haven't already
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3 text-left">
                  <Shield className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Admin Review</p>
                    <p className="text-xs text-muted-foreground">
                      An administrator will review your registration shortly
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3 text-left">
                  <CheckCircle2 className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Get Started</p>
                    <p className="text-xs text-muted-foreground">
                      Once approved, you'll be able to access your dashboard
                    </p>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t">
                <p className="text-xs text-muted-foreground mb-4">
                  This usually takes less than 24 hours. You'll receive an email once approved.
                </p>
                <Button 
                  onClick={checkAccountStatus} 
                  variant="outline" 
                  size="sm"
                  className="w-full"
                >
                  Check Status
                </Button>
              </div>
            </div>

            <div className="pt-4 border-t">
              <Button 
                onClick={handleSignOut} 
                variant="ghost" 
                size="sm"
                className="w-full"
              >
                Sign Out
              </Button>
            </div>
          </CardContent>
        </Card>

        <p className="text-xs text-center text-muted-foreground">
          Questions? Contact us at support@sideline.app
        </p>
      </div>
    </div>
  );
}
