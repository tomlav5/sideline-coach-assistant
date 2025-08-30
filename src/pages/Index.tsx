import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar, Trophy, Clock, Users, ArrowRight } from 'lucide-react';

const Index = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  // Extract first name from user metadata
  const firstName = user?.user_metadata?.first_name || 'Coach';

  const shortcuts = [
    {
      title: 'Fixtures',
      description: 'Schedule and manage upcoming matches',
      icon: Calendar,
      path: '/fixtures',
      color: 'bg-blue-500 hover:bg-blue-600',
    },
    {
      title: 'Match Day',
      description: 'Live match tracking and timer',
      icon: Clock,
      path: '/match-day',
      color: 'bg-green-500 hover:bg-green-600',
    },
    {
      title: 'Reports',
      description: 'View match results and statistics',
      icon: Trophy,
      path: '/reports',
      color: 'bg-purple-500 hover:bg-purple-600',
    },
    {
      title: 'Teams',
      description: 'Manage your teams and squads',
      icon: Users,
      path: '/teams',
      color: 'bg-orange-500 hover:bg-orange-600',
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/20">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Welcome Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
            Welcome back, {firstName}!
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Your sideline coaching assistant is ready. Manage fixtures, track matches, 
            and analyze your team's performance all in one place.
          </p>
        </div>

        {/* Quick Actions Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-6 mb-8">
          {shortcuts.map((shortcut) => {
            const IconComponent = shortcut.icon;
            return (
              <Card 
                key={shortcut.path}
                className="group hover:shadow-lg transition-all duration-300 cursor-pointer border-2 hover:border-primary/20"
                onClick={() => navigate(shortcut.path)}
              >
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <div className={`p-3 rounded-lg ${shortcut.color} text-white`}>
                      <IconComponent className="h-6 w-6" />
                    </div>
                    <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                  <CardTitle className="text-xl">{shortcut.title}</CardTitle>
                  <CardDescription className="text-base">
                    {shortcut.description}
                  </CardDescription>
                </CardHeader>
              </Card>
            );
          })}
        </div>

        {/* Quick Stats Preview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card className="bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200 dark:border-blue-800">
            <CardContent className="p-6 text-center">
              <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                Quick Access
              </div>
              <div className="text-sm text-blue-600 dark:text-blue-400 mt-2">
                Everything you need at your fingertips
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-r from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 border-green-200 dark:border-green-800">
            <CardContent className="p-6 text-center">
              <div className="text-2xl font-bold text-green-700 dark:text-green-300">
                Live Tracking
              </div>
              <div className="text-sm text-green-600 dark:text-green-400 mt-2">
                Real-time match monitoring
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-r from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 border-purple-200 dark:border-purple-800">
            <CardContent className="p-6 text-center">
              <div className="text-2xl font-bold text-purple-700 dark:text-purple-300">
                Analytics
              </div>
              <div className="text-sm text-purple-600 dark:text-purple-400 mt-2">
                Detailed performance insights
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Coming Soon Section */}
        <Card className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 border-dashed">
          <CardContent className="p-8 text-center">
            <div className="text-2xl font-bold text-muted-foreground mb-2">
              AI Assistant Coming Soon
            </div>
            <div className="text-muted-foreground">
              Get intelligent insights and recommendations powered by AI to help improve your team's performance
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Index;
