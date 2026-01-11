import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Shield, Loader2 } from 'lucide-react';

export default function AuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    handleAuthCallback();
  }, []);

  const handleAuthCallback = async () => {
    try {
      // Get the session from the URL hash
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError) {
        throw sessionError;
      }

      if (!session) {
        throw new Error('No session found');
      }

      // Check user's account status
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('account_status')
        .eq('user_id', session.user.id)
        .single();

      if (profileError) {
        console.error('Error fetching profile:', profileError);
        // If profile doesn't exist yet, it might be creating - redirect to pending
        navigate('/pending-approval');
        return;
      }

      // Route based on account status
      switch (profile?.account_status) {
        case 'approved':
          navigate('/');
          break;
        case 'rejected':
          navigate('/pending-approval');
          break;
        case 'pending':
        default:
          navigate('/pending-approval');
          break;
      }
    } catch (error: any) {
      console.error('Auth callback error:', error);
      setError(error.message || 'Authentication failed');
      
      // Redirect to auth page after a delay
      setTimeout(() => {
        navigate('/auth');
      }, 3000);
    }
  };

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-6 text-center">
          <div className="flex items-center justify-center space-x-2">
            <Shield className="h-8 w-8 text-destructive" />
            <h1 className="text-3xl font-bold">SideLine</h1>
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-destructive">Authentication Error</h2>
            <p className="text-sm text-muted-foreground">{error}</p>
            <p className="text-xs text-muted-foreground">Redirecting to login...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6 text-center">
        <div className="flex items-center justify-center space-x-2">
          <Shield className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold text-primary">SideLine</h1>
        </div>
        <div className="space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
          <p className="text-sm text-muted-foreground">Completing sign in...</p>
        </div>
      </div>
    </div>
  );
}
