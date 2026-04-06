
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useUser } from '@/hooks/use-user';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'wouter';
import { useProfileCompletion } from '@/hooks/use-profile-completion';
import { Progress } from '@/components/ui/progress';

export default function ProfileCompletionNotification() {
  const { user } = useUser();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [dismissed, setDismissed] = useState(false);
  const { completionPercentage, isLoading } = useProfileCompletion();

  if (!user || dismissed || completionPercentage === 100 || isLoading) {
    return null;
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50">
      <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-xl shadow-lg max-w-md w-full mx-4">
        <div className="space-y-4">
          <h3 className="text-xl font-semibold text-blue-900">Complete Your Profile</h3>
          <p className="text-blue-700">
            Completing your profile helps us give better health insights
          </p>
          <div className="space-y-2">
            <Progress value={completionPercentage} className="h-2 bg-blue-200" indicatorClassName="bg-blue-600" />
            <p className="text-sm text-blue-600 font-medium">{completionPercentage}% Complete</p>
          </div>
          <div className="flex gap-3 pt-2">
            <Button 
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
              onClick={() => setLocation('/profile')}
            >
              Complete Profile
            </Button>
            <Button
              className="bg-transparent hover:bg-blue-100 text-blue-600"
              variant="ghost"
              onClick={() => setDismissed(true)}
            >
              Dismiss
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
