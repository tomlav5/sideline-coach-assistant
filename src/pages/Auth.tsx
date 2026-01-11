import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Shield, Users, BarChart3, Chrome, Facebook } from 'lucide-react';
import { authSignInSchema, authSignUpSchema } from '@/lib/validation';
import { toast } from '@/hooks/use-toast';

export default function Auth() {
  const [isLoading, setIsLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<string | null>(null);
  const { signIn, signUp, signInWithOAuth } = useAuth();
  const navigate = useNavigate();

  const handleSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    
    const formData = new FormData(e.currentTarget);
    const rawData = {
      email: formData.get('email') as string,
      password: formData.get('password') as string,
    };

    // Validate input data
    const validation = authSignInSchema.safeParse(rawData);
    if (!validation.success) {
      const errors = validation.error.errors.map(err => err.message).join(', ');
      toast({
        title: "Validation Error",
        description: errors,
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }

    const { email, password } = validation.data;
    const { error } = await signIn(email, password);
    if (!error) {
      navigate('/');
    }
    setIsLoading(false);
  };

  const handleSignUp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    
    const formData = new FormData(e.currentTarget);
    const rawData = {
      email: formData.get('email') as string,
      password: formData.get('password') as string,
      firstName: formData.get('firstName') as string,
      lastName: formData.get('lastName') as string,
    };

    // Validate input data
    const validation = authSignUpSchema.safeParse(rawData);
    if (!validation.success) {
      const errors = validation.error.errors.map(err => err.message).join(', ');
      toast({
        title: "Validation Error",
        description: errors,
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }

    const { email, password, firstName, lastName } = validation.data;
    const { error } = await signUp(email, password, firstName, lastName);
    
    if (!error) {
      navigate('/registration-success');
    }
    
    setIsLoading(false);
  };

  const handleOAuthSignIn = async (provider: 'google' | 'apple' | 'facebook') => {
    setOauthLoading(provider);
    await signInWithOAuth(provider);
    // OAuth will redirect, so loading state will persist
  };

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

        {/* Features */}
        <div className="grid grid-cols-3 gap-4 py-4">
          <div className="text-center space-y-2">
            <Users className="h-6 w-6 text-primary mx-auto" />
            <p className="text-xs text-muted-foreground">Team Management</p>
          </div>
          <div className="text-center space-y-2">
            <Shield className="h-6 w-6 text-primary mx-auto" />
            <p className="text-xs text-muted-foreground">Match Tracking</p>
          </div>
          <div className="text-center space-y-2">
            <BarChart3 className="h-6 w-6 text-primary mx-auto" />
            <p className="text-xs text-muted-foreground">Player Stats</p>
          </div>
        </div>

        {/* Auth Forms */}
        <Card>
          <CardHeader>
            <CardTitle>Get Started</CardTitle>
            <CardDescription>
              Sign in to your account or create a new one
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="signin" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">Sign In</TabsTrigger>
                <TabsTrigger value="signup">Sign Up</TabsTrigger>
              </TabsList>
              
              <TabsContent value="signin" className="space-y-4">
                {/* OAuth Buttons */}
                <div className="space-y-3">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full touch-target"
                    onClick={() => handleOAuthSignIn('google')}
                    disabled={oauthLoading !== null}
                  >
                    <Chrome className="h-4 w-4 mr-2" />
                    {oauthLoading === 'google' ? 'Connecting...' : 'Continue with Google'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full touch-target"
                    onClick={() => handleOAuthSignIn('facebook')}
                    disabled={oauthLoading !== null}
                  >
                    <Facebook className="h-4 w-4 mr-2" />
                    {oauthLoading === 'facebook' ? 'Connecting...' : 'Continue with Facebook'}
                  </Button>
                </div>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">
                      Or continue with email
                    </span>
                  </div>
                </div>

                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signin-email">Email</Label>
                    <Input
                      id="signin-email"
                      name="email"
                      type="email"
                      placeholder="coach@example.com"
                      required
                      className="touch-target"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signin-password">Password</Label>
                    <Input
                      id="signin-password"
                      name="password"
                      type="password"
                      required
                      className="touch-target"
                    />
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full touch-target" 
                    disabled={isLoading}
                  >
                    {isLoading ? 'Signing in...' : 'Sign In'}
                  </Button>
                </form>
              </TabsContent>
              
              <TabsContent value="signup" className="space-y-4">
                {/* OAuth Buttons */}
                <div className="space-y-3">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full touch-target"
                    onClick={() => handleOAuthSignIn('google')}
                    disabled={oauthLoading !== null}
                  >
                    <Chrome className="h-4 w-4 mr-2" />
                    {oauthLoading === 'google' ? 'Connecting...' : 'Sign up with Google'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full touch-target"
                    onClick={() => handleOAuthSignIn('facebook')}
                    disabled={oauthLoading !== null}
                  >
                    <Facebook className="h-4 w-4 mr-2" />
                    {oauthLoading === 'facebook' ? 'Connecting...' : 'Sign up with Facebook'}
                  </Button>
                </div>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">
                      Or sign up with email
                    </span>
                  </div>
                </div>

                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-2">
                      <Label htmlFor="firstName">First Name</Label>
                      <Input
                        id="firstName"
                        name="firstName"
                        placeholder="John"
                        required
                        className="touch-target"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastName">Last Name</Label>
                      <Input
                        id="lastName"
                        name="lastName"
                        placeholder="Doe"
                        required
                        className="touch-target"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email</Label>
                    <Input
                      id="signup-email"
                      name="email"
                      type="email"
                      placeholder="coach@example.com"
                      required
                      className="touch-target"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Password</Label>
                    <Input
                      id="signup-password"
                      name="password"
                      type="password"
                      required
                      className="touch-target"
                      minLength={6}
                    />
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full touch-target" 
                    disabled={isLoading}
                  >
                    {isLoading ? 'Creating account...' : 'Create Account'}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <p className="text-xs text-center text-muted-foreground">
          By continuing, you agree to our terms of service and privacy policy.
        </p>
      </div>
    </div>
  );
}