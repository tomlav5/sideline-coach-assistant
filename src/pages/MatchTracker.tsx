// This is a placeholder to prevent the old MatchTracker from breaking the build
// The enhanced version should be used instead

import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function MatchTrackerLegacy() {
  const navigate = useNavigate();

  return (
    <div className="container mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle>Legacy Match Tracker</CardTitle>
          <CardDescription>
            This version is no longer supported. Please use the Enhanced Match Tracker instead.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>The database schema has been updated to support flexible periods and better tracking.</p>
          <div className="flex gap-2">
            <Button onClick={() => navigate('/fixtures')}>
              Back to Fixtures
            </Button>
            <Button onClick={() => navigate('/dashboard')}>
              Dashboard
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}