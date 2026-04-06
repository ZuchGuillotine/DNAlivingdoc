import { useUser } from '../hooks/use-user';
import { Button } from './ui/button';
import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { CalendarIcon, CheckCircleIcon } from 'lucide-react';
import { useLocation } from 'wouter';

interface SubscriptionCheckProps {
  showAsModal?: boolean;
  reason?: 'signup' | 'usage_limit' | 'trial_expiring';
}

export function SubscriptionCheck({ showAsModal = false, reason }: SubscriptionCheckProps) {
  const { user } = useUser();
  const [loading, setLoading] = useState(false);
  const [, setLocation] = useLocation();

  const handleSubscribe = async (isYearly: boolean) => {
    setLoading(true);
    try {
      // Get the appropriate price ID from our helper
      const { PRODUCTS } = await import('@/lib/stripe-price-ids');
      const priceId = isYearly 
        ? PRODUCTS.PRO.tiers.YEARLY.id
        : PRODUCTS.PRO.tiers.MONTHLY.id;

      const response = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId }),
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to start subscription');
      }

      const { url } = await response.json();
      window.location.href = url;
    } catch (error: any) {
      console.error('Failed to start subscription:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStartTrial = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/stripe/start-free-trial', {
        method: 'POST',
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to start trial');
      }

      console.log('Trial started successfully, redirecting to dashboard');
      setLocation('/');
    } catch (error) {
      console.error('Failed to start trial:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTitle = () => {
    switch (reason) {
      case 'signup':
        return 'Choose Your Plan';
      case 'usage_limit':
        return 'Daily Limit Reached';
      case 'trial_expiring':
        return 'Trial Period Ending Soon';
      default:
        return 'Upgrade to Pro';
    }
  };

  const getDescription = () => {
    switch (reason) {
      case 'signup':
        return 'Start your journey with StackTracker Pro and unlock all features!';
      case 'usage_limit':
        return 'You\'ve reached your daily limit of 5 AI interactions. Upgrade to Pro for unlimited access!';
      case 'trial_expiring':
        return 'Your trial period is ending soon. Upgrade now to keep accessing all features!';
      default:
        return 'Unlock unlimited chat and more features!';
    }
  };

  const content = (
    <div className="space-y-6">
      <div className="space-y-2">
        {/* Free Trial Option */}
        {reason === 'signup' && (
          <Button 
            onClick={handleStartTrial}
            disabled={loading}
            className="w-full bg-green-600 hover:bg-green-700 mb-4"
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {loading ? "Starting Trial..." : "Start 28-Day Free Trial"}
          </Button>
        )}

        {/* Monthly Option */}
        <Button 
          onClick={() => handleSubscribe(false)} 
          disabled={loading}
          className="w-full"
        >
          {loading ? "Processing..." : "Monthly - $21.99/month"}
        </Button>

        {/* Yearly Option */}
        <Button 
          onClick={() => handleSubscribe(true)} 
          disabled={loading}
          variant="outline"
          className="w-full mt-2"
        >
          {loading ? "Processing..." : "Yearly - $184.71/year (Save 30%)"}
        </Button>
      </div>

      <div className="space-y-2 text-sm text-gray-500">
        <div className="flex items-center">
          <CheckCircleIcon className="h-4 w-4 mr-2 text-green-500" />
          Unlimited AI Interactions
        </div>
        <div className="flex items-center">
          <CheckCircleIcon className="h-4 w-4 mr-2 text-green-500" />
          Advanced Analytics
        </div>
        <div className="flex items-center">
          <CheckCircleIcon className="h-4 w-4 mr-2 text-green-500" />
          Priority Support
        </div>
      </div>
    </div>
  );

  if (user?.isPro) return null;

  return showAsModal ? (
    <Dialog open={true} onOpenChange={undefined}>
      <DialogContent 
        className="sm:max-w-[425px]" 
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{getTitle()}</DialogTitle>
          <DialogDescription>{getDescription()}</DialogDescription>
        </DialogHeader>
        {content}
      </DialogContent>
    </Dialog>
  ) : (
    <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
      <h3 className="text-lg font-semibold mb-2">{getTitle()}</h3>
      <p className="mb-4">{getDescription()}</p>
      {content}
    </div>
  );
}