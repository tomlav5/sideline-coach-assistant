import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/hooks/useTheme';
import { Settings2, Sun, Moon, Monitor } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function Settings() {
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();
  const [isDark, setIsDark] = useState(theme === 'dark');

  const handleThemeToggle = (checked: boolean) => {
    setIsDark(checked);
    setTheme(checked ? 'dark' : 'light');
    toast({
      title: "Theme Updated",
      description: `Switched to ${checked ? 'dark' : 'light'} mode`,
    });
  };

  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl">
      <div className="flex items-center space-x-3 mb-6">
        <Settings2 className="h-8 w-8 text-primary" />
        <h1 className="text-3xl font-bold">Settings</h1>
      </div>

      <div className="space-y-6">
        {/* Appearance Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Appearance</CardTitle>
            <CardDescription>
              Customize how SideLine Assist looks and feels
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Theme Toggle */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="theme-toggle" className="text-base">
                  Dark Mode
                </Label>
                <div className="text-sm text-muted-foreground">
                  Switch between light and dark themes
                </div>
              </div>
              <Switch
                id="theme-toggle"
                checked={isDark}
                onCheckedChange={handleThemeToggle}
              />
            </div>

            {/* Theme Preview */}
            <div className="space-y-3">
              <Label className="text-base">Theme Preview</Label>
              <div className="grid grid-cols-3 gap-3">
                <Button
                  variant={theme === 'light' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => {
                    setTheme('light');
                    setIsDark(false);
                  }}
                  className="flex items-center space-x-2"
                >
                  <Sun className="h-4 w-4" />
                  <span>Light</span>
                </Button>
                <Button
                  variant={theme === 'dark' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => {
                    setTheme('dark');
                    setIsDark(true);
                  }}
                  className="flex items-center space-x-2"
                >
                  <Moon className="h-4 w-4" />
                  <span>Dark</span>
                </Button>
                <Button
                  variant={theme === 'system' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => {
                    setTheme('system');
                    setIsDark(window.matchMedia('(prefers-color-scheme: dark)').matches);
                  }}
                  className="flex items-center space-x-2"
                >
                  <Monitor className="h-4 w-4" />
                  <span>System</span>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* App Information */}
        <Card>
          <CardHeader>
            <CardTitle>About SideLine Assist</CardTitle>
            <CardDescription>
              Your comprehensive football coaching companion
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm space-y-2">
              <p>
                <strong>Version:</strong> 1.0.0
              </p>
              <p>
                <strong>Features:</strong> Match tracking, squad management, fixture planning, and detailed reports
              </p>
              <p className="text-muted-foreground">
                SideLine Assist helps football coaches manage their teams effectively with 
                real-time match tracking, comprehensive player statistics, and intuitive 
                fixture management.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Help Section */}
        <Card>
          <CardHeader>
            <CardTitle>Help & Support</CardTitle>
            <CardDescription>
              Get the most out of SideLine Assist
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div>
                <h4 className="font-medium">Quick Start Guide</h4>
                <p className="text-sm text-muted-foreground">
                  1. Create your teams and add players<br/>
                  2. Schedule fixtures with opponents<br/>
                  3. Select your squad for each match<br/>
                  4. Use live match tracking during games<br/>
                  5. Review detailed reports and statistics
                </p>
              </div>
              
              <div>
                <h4 className="font-medium">Match Tracking</h4>
                <p className="text-sm text-muted-foreground">
                  During matches, track goals, assists, and playing time. 
                  The app will continue running even if you switch to other apps.
                </p>
              </div>

              <div>
                <h4 className="font-medium">Squad Selection</h4>
                <p className="text-sm text-muted-foreground">
                  Save squad selections for each fixture. Your most recent squad 
                  can be loaded automatically for new fixtures.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}