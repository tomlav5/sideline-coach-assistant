import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Shield, Users, BarChart3, Mail, ArrowLeft } from 'lucide-react';
import { authSignUpSchema, otpEmailSchema } from '@/lib/validation';
import { toast } from '@/hooks/use-toast';

export default function Auth() {
  const [isLoading, setIsLoading] = useState(false);
  const [otpStep, setOtpStep] = useState<'email' | 'code'>('email');
  const [otpEmail, setOtpEmail] = useState('');
  const { signUp, signInWithOtp } = useAuth();
  const navigate = useNavigate();

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

  const handleSendOtp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    const validation = otpEmailSchema.safeParse({ email: otpEmail });
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

    const { error } = await signInWithOtp(validation.data.email);
    if (!error) {
      setOtpStep('code');
    }
    setIsLoading(false);
  };

  const handleVerifyOtp = async () => {
    if (otpCode.length !== 6) {
      toast({
        title: "Invalid code",
        description: "Please enter the full 6-digit code.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    const { error } = await verifyOtp(otpEmail, otpCode);
    if (!error) {
      navigate('/');
    }
    setIsLoading(false);
  };

  const handleResendOtp = async () => {
    setIsLoading(true);
    await signInWithOtp(otpEmail);
    setIsLoading(false);
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
                <TabsTrigger value="signup">Register</TabsTrigger>
              </TabsList>
              
              <TabsContent value="signin" className="space-y-4">
                {otpStep === 'email' ? (
                  <>
                    <p className="text-sm text-muted-foreground text-center">
                      Enter your email and we'll send you a 6-digit code to sign in.
                    </p>
                    <form onSubmit={handleSendOtp} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="otp-email">Email</Label>
                        <Input
                          id="otp-email"
                          type="email"
                          placeholder="coach@example.com"
                          value={otpEmail}
                          onChange={(e) => setOtpEmail(e.target.value)}
                          required
                          className="touch-target"
                        />
                      </div>
                      <Button
                        type="submit"
                        className="w-full touch-target"
                        disabled={isLoading}
                      >
                        <Mail className="h-4 w-4 mr-2" />
                        {isLoading ? 'Sending...' : 'Send Sign In Code'}
                      </Button>
                    </form>
                  </>
                ) : (
                  <div className="space-y-4">
                    <div className="text-center space-y-2">
                      <Mail className="h-10 w-10 text-primary mx-auto" />
                      <p className="text-sm font-medium">Check your email</p>
                      <p className="text-xs text-muted-foreground">
                        We've sent a sign-in link to <span className="font-medium text-foreground">{otpEmail}</span>. Click the link in the email to log in.
                      </p>
                    </div>

                    <div className="rounded-md bg-muted p-3 text-xs text-muted-foreground text-center">
                      Didn't receive it? Check your spam folder or try again.
                    </div>

                    <div className="flex items-center justify-between">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setOtpStep('email');
                        }}
                        disabled={isLoading}
                      >
                        <ArrowLeft className="h-4 w-4 mr-1" />
                        Back
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleResendOtp}
                        disabled={isLoading}
                      >
                        Resend Link
                      </Button>
                    </div>
                  </div>
                )}
              </TabsContent>
              
              <TabsContent value="signup" className="space-y-4">
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
