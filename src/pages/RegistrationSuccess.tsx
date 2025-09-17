import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, Mail, CheckCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function RegistrationSuccess() {
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

        {/* Success Card */}
        <Card>
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <CheckCircle className="h-16 w-16 text-green-500" />
            </div>
            <CardTitle className="text-2xl">Welcome to SideLine!</CardTitle>
            <CardDescription>
              Your account has been created successfully
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <Mail className="h-12 w-12 text-primary" />
              </div>
              <div className="space-y-2">
                <h3 className="font-semibold">Check your email</h3>
                <p className="text-sm text-muted-foreground">
                  We've sent you a confirmation link to activate your account. 
                  Please check your inbox and click the link to get started.
                </p>
              </div>
            </div>

            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <h4 className="font-medium text-sm">What's next?</h4>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>• Click the confirmation link in your email</li>
                <li>• Set up your first club</li>
                <li>• Add your teams and players</li>
                <li>• Start tracking matches</li>
              </ul>
            </div>

            <div className="space-y-3">
              <p className="text-xs text-center text-muted-foreground">
                Didn't receive the email? Check your spam folder or contact support.
              </p>
              <Button asChild variant="outline" className="w-full">
                <Link to="/auth">Back to Sign In</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <p className="text-xs text-center text-muted-foreground">
          Need help? Contact our support team
        </p>
      </div>
    </div>
  );
}