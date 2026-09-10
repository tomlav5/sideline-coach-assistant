import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Shield, Users, BarChart3, Mail, ArrowLeft } from 'lucide-react';
import { authSignUpSchema, otpEmailSchema } from '@/lib/validation';
import { toast } from '@/hooks/use-toast';

export default function Auth() {
  const [isLoading, setIsLoading] = useState(false);
  const [otpStep, setOtpStep] = useState<'email' | 'code'>('email');
  const [otpEmail, setOtpEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  // Supabase rate-limits OTP requests to ~one per 30s. Track the remaining wait
  // so the Resend button can show it in advance rather than the user discovering
  // it by a silent failure (ONBOARD-003).
  const [resendCooldown, setResendCooldown] = useState(0);
  const cooldownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { signUp, signInWithOtp, signInWithPassword, verifyOtp } = useAuth();
  const navigate = useNavigate();
  const isDev = import.meta.env.DEV;

  // Every OTP send — the first one on the email step included — counts against
  // the rate limit, so start the countdown on any successful send.
  const startResendCooldown = () => {
    if (cooldownIntervalRef.current) clearInterval(cooldownIntervalRef.current);
    setResendCooldown(30);
    cooldownIntervalRef.current = setInterval(() => {
      setResendCooldown((seconds) => {
        if (seconds <= 1) {
          if (cooldownIntervalRef.current) {
            clearInterval(cooldownIntervalRef.current);
            cooldownIntervalRef.current = null;
          }
          return 0;
        }
        return seconds - 1;
      });
    }, 1000);
  };

  useEffect(() => {
    return () => {
      if (cooldownIntervalRef.current) clearInterval(cooldownIntervalRef.current);
    };
  }, []);

  const handleSignUp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    
    const formData = new FormData(e.currentTarget);
    const rawData = {
      email: formData.get('email') as string,
      password: formData.get('password') as string,
      confirmPassword: formData.get('confirmPassword') as string,
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
    const { error, alreadyRegistered } = await signUp(email, password, firstName, lastName);

    if (alreadyRegistered) {
      toast({
        title: "Account already exists",
        description: "An account already exists for this email. Try signing in, or use the emailed code if you've forgotten your password.",
      });
    } else if (!error) {
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
      setOtpCode('');
      startResendCooldown();
    }
    setIsLoading(false);
  };


  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;
    setIsLoading(true);
    const { error } = await signInWithOtp(otpEmail);
    setIsLoading(false);

    if (error) {
      const isRateLimit =
        error?.status === 429 ||
        /rate limit|too many requests|after \d+ seconds|only request this/i.test(
          error?.message ?? '',
        );
      toast({
        title: isRateLimit ? 'Too many requests' : 'Could not resend code',
        description: isRateLimit
          ? 'Wait 30 seconds, then try again — and check your junk folder.'
          : error.message || 'Something went wrong. Please try again.',
        variant: 'destructive',
      });
      return;
    }

    setOtpCode('');
    startResendCooldown();
  };

  const handleVerifyCode = async (code?: string) => {
    const codeToVerify = (code ?? otpCode).trim();
    if (codeToVerify.length !== 6) {
      toast({
        title: "Invalid code",
        description: "Please enter the 6-digit code from your email.",
        variant: "destructive",
      });
      return;
    }
    setIsLoading(true);
    const { error } = await verifyOtp(otpEmail, codeToVerify);
    setIsLoading(false);
    if (!error) {
      navigate('/');
    } else {
      setOtpCode('');
    }
  };

  const handlePasswordSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    const { error } = await signInWithPassword(email, password);
    
    if (!error) {
      navigate('/');
    }
    
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
            <Tabs defaultValue={isDev ? "devlogin" : "signin"} className="w-full">
              <TabsList className={`grid w-full ${isDev ? 'grid-cols-3' : 'grid-cols-2'}`}>
                <TabsTrigger value="signin">Sign In</TabsTrigger>
                <TabsTrigger value="signup">Register</TabsTrigger>
                {isDev && <TabsTrigger value="devlogin">Dev Login</TabsTrigger>}
              </TabsList>
              
              <TabsContent value="signin" className="space-y-4">
                {otpStep === 'email' ? (
                  <>
                    <p className="text-sm text-muted-foreground text-center">
                      Enter your email and we'll send you a sign-in link.
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
                        {isLoading ? 'Sending…' : 'Send Sign In Link & Code'}
                      </Button>
                      {isLoading && (
                        <p className="text-xs text-muted-foreground text-center animate-pulse">
                          This may take a few seconds…
                        </p>
                      )}
                    </form>
                  </>
                ) : (
                  <div className="space-y-4">
                    <div className="text-center space-y-2">
                      <Mail className="h-10 w-10 text-primary mx-auto" />
                      <p className="text-sm font-medium">Check your email</p>
                      <p className="text-xs text-muted-foreground">
                        We've sent a sign-in link <span className="font-medium">and</span> a 6-digit code to <span className="font-medium text-foreground">{otpEmail}</span>.
                      </p>
                    </div>

                    <div className="rounded-md border bg-muted/40 p-4 space-y-3">
                      <p className="text-sm font-medium text-center">
                        1. Click the link in your email
                      </p>
                      <div className="flex items-center gap-3">
                        <div className="flex-1 border-t" />
                        <span className="text-xs text-muted-foreground uppercase tracking-wider">or</span>
                        <div className="flex-1 border-t" />
                      </div>
                      <p className="text-sm font-medium text-center">
                        2. Enter the 6-digit code below
                      </p>
                      <div className="flex justify-center pt-1">
                        <InputOTP
                          maxLength={6}
                          value={otpCode}
                          onChange={(value) => {
                            setOtpCode(value);
                            if (value.length === 6) {
                              handleVerifyCode(value);
                            }
                          }}
                          disabled={isLoading}
                        >
                          <InputOTPGroup>
                            <InputOTPSlot index={0} />
                            <InputOTPSlot index={1} />
                            <InputOTPSlot index={2} />
                            <InputOTPSlot index={3} />
                            <InputOTPSlot index={4} />
                            <InputOTPSlot index={5} />
                          </InputOTPGroup>
                        </InputOTP>
                      </div>
                      <Button
                        type="button"
                        className="w-full touch-target"
                        onClick={() => handleVerifyCode()}
                        disabled={isLoading || otpCode.length !== 6}
                      >
                        {isLoading ? 'Verifying…' : 'Verify Code'}
                      </Button>
                    </div>

                    <div className="rounded-md bg-muted p-3 text-xs text-muted-foreground text-center">
                      Didn't receive the email? Check your spam folder or resend below.
                    </div>

                    <div className="flex items-center justify-between">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setOtpStep('email');
                          setOtpCode('');
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
                        disabled={isLoading || resendCooldown > 0}
                      >
                        {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Code'}
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
                  <div className="space-y-2">
                    <Label htmlFor="signup-confirm-password">Confirm Password</Label>
                    <Input
                      id="signup-confirm-password"
                      name="confirmPassword"
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

              {/* Dev-Only Password Login */}
              {isDev && (
                <TabsContent value="devlogin" className="space-y-4">
                  <div className="rounded-lg border-2 border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20 p-3">
                    <p className="text-xs font-medium text-yellow-800 dark:text-yellow-200 text-center">
                      🔧 Development Mode Only - Password Login
                    </p>
                  </div>
                  <p className="text-sm text-muted-foreground text-center">
                    Sign in with email and password (no OTP required)
                  </p>
                  <form onSubmit={handlePasswordSignIn} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="dev-email">Email</Label>
                      <Input
                        id="dev-email"
                        name="email"
                        type="email"
                        placeholder="coach@example.com"
                        required
                        className="touch-target"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="dev-password">Password</Label>
                      <Input
                        id="dev-password"
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
                      {isLoading ? 'Signing in...' : 'Sign In with Password'}
                    </Button>
                  </form>
                  <p className="text-xs text-center text-muted-foreground">
                    This tab only appears in development environment
                  </p>
                </TabsContent>
              )}
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
