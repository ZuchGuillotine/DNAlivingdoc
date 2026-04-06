import { useUser } from '@/hooks/use-user';
import { Button } from '@/components/ui/button';
import { CalendarIcon, CheckCircleIcon } from 'lucide-react';
import { useState } from 'react';
import { useLocation } from 'wouter';
import { useToast } from '@/hooks/use-toast';
import { PaymentOptionsModal } from '@/components/PaymentOptionsModal';

export default function SubscriptionPage() {
  const { user } = useUser();
  const [loading, setLoading] = useState(false);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // Prevent accessing this page directly if already subscribed
  if (user?.isPro) {
    setLocation('/');
    return null;
  }

  const handleSubscribe = async (planType: 'monthlyWithTrial' | 'monthly' | 'yearly') => {
    setLoading(true);
    try {
      // For the free trial option, redirect directly to Stripe's hosted page
      if (planType === 'monthlyWithTrial') {
        window.location.href = 'https://buy.stripe.com/eVa6rr9kw6GD9e8aEE';
        return;
      }

      // For paid options, create a checkout session
      let priceId;
      switch (planType) {
        case 'yearly':
          priceId = 'prod_RpdfGxB4L6Rut7';
          break;
        case 'monthly':
          priceId = 'prod_RtcuCvjOY9gHvm';
          break;
        default:
          throw new Error('Invalid plan type selected');
      }

      console.log('Creating checkout session with priceId:', priceId);

      const response = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ priceId }),
        credentials: 'include'
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create checkout session');
      }

      const { url } = await response.json();
      if (!url) {
        throw new Error('No checkout URL received');
      }

      window.location.href = url;
    } catch (error) {
      console.error('Error creating checkout session:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to start subscription process. Please try again."
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#e8f3e8] flex flex-col">
      <div className="flex-grow flex items-center justify-center p-4">
        <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-lg shadow-lg">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-gray-900">Choose Your Plan</h2>
            <p className="mt-2 text-gray-600">
              Start your journey with StackTracker Pro and unlock all features!
            </p>
          </div>

          <div className="space-y-4">
            {/* Free Trial Option */}
            <Button 
              onClick={() => handleSubscribe('monthlyWithTrial')}
              disabled={loading}
              className="w-full bg-green-600 hover:bg-green-700"
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {loading ? "Processing..." : "Start 28-Day Free Trial"}
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">Or subscribe now</span>
              </div>
            </div>

            {/* Monthly Option */}
            <Button 
              onClick={() => handleSubscribe('monthly')}
              disabled={loading}
              className="w-full"
            >
              {loading ? "Processing..." : "Monthly - $21.99/month"}
            </Button>

            {/* Yearly Option */}
            <Button 
              onClick={() => handleSubscribe('yearly')}
              disabled={loading}
              variant="outline"
              className="w-full"
            >
              {loading ? "Processing..." : "Yearly - $184.71/year (Save 30%)"}
            </Button>
          </div>

          <div className="space-y-3 mt-8">
            <h3 className="text-lg font-semibold text-gray-900">What's included:</h3>
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
        </div>
      </div>
      {/* Only show modal for new registrations */}
      {new URLSearchParams(window.location.search).has('newUser') && (
        <PaymentOptionsModal isOpen={true} onClose={() => window.location.href = '/'} />
      )}
    </div>
  );
}