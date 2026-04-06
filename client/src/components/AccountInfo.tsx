/**
    * @description      : 
    * @author           : 
    * @group            : 
    * @created          : 14/06/2025 - 00:32:32
    * 
    * MODIFICATION LOG
    * - Version         : 1.0.0
    * - Date            : 14/06/2025
    * - Author          : 
    * - Modification    : 
**/
import { useUser } from '../hooks/use-user';
import { Card, CardContent, CardHeader } from './ui/card';
import { Button } from './ui/button';
import { CalendarIcon, CreditCardIcon, Award, MessageSquare, FileText } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Progress } from './ui/progress';
import { useToast } from '@/hooks/use-toast';

// Tier limits based on tierLimitService.ts
const TIER_LIMITS = {
  free: {
    aiInteractions: 100,
    labUploads: 0
  },
  starter: {
    aiInteractions: 100,
    labUploads: 3
  },
  pro: {
    aiInteractions: Infinity,
    labUploads: Infinity
  }
};

const TIER_PRICING = {
  starter: {
    monthly: 7.99,
    yearly: 69.00,
    yearlySavings: 26.88
  },
  pro: {
    monthly: 14.99,
    yearly: 99.00,
    yearlySavings: 80.88
  }
};

export function AccountInfo() {
  const { user } = useUser();
  const [streakDays, setStreakDays] = useState(0);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    // Fetch streak information on component mount
    const fetchStreak = async () => {
      try {
        const response = await fetch('/api/supplements/streak', {
          credentials: 'include' // Important for auth
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || 'Failed to fetch streak data');
        }

        const data = await response.json();
        setStreakDays(Number(data.streakDays) || 0); // Ensure it's a number
      } catch (error: any) {
        console.error('Failed to fetch streak:', error);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to load streak data"
        });
      }
    };
    fetchStreak();
  }, [toast]);

  const formatDate = (date: string | null) => {
    if (!date) return 'N/A';
    try {
      return new Date(date).toLocaleDateString();
    } catch {
      return 'N/A';
    }
  };

  const getRemainingDays = (trialEndDate: string | null) => {
    if (!trialEndDate) return 0;
    try {
      const end = new Date(trialEndDate);
      const now = new Date();
      const diffTime = end.getTime() - now.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return Math.max(0, diffDays);
    } catch {
      return 0;
    }
  };

  const getSubscriptionStatus = () => {
    if (!user?.subscriptionTier) return { tier: 'free', label: 'Free', color: 'bg-gray-100 text-gray-800' };
    
    switch (user.subscriptionTier) {
      case 'pro':
        return { tier: 'pro', label: 'Pro', color: 'bg-green-100 text-green-800' };
      case 'starter':
        return { tier: 'starter', label: 'Starter', color: 'bg-blue-100 text-blue-800' };
      case 'free':
      default:
        return { tier: 'free', label: 'Free Trial', color: 'bg-gray-100 text-gray-800' };
    }
  };

  const getUsageLimits = () => {
    const tier = user?.subscriptionTier || 'free';
    return TIER_LIMITS[tier as keyof typeof TIER_LIMITS] || TIER_LIMITS.free;
  };

  const getUsageProgress = (current: number, limit: number) => {
    if (limit === Infinity) return 0; // Unlimited
    return Math.min((current / limit) * 100, 100);
  };

  const handleExtendTrial = async () => {
    if (loading || streakDays < 14) return;
    setLoading(true);
    try {
      const response = await fetch('/api/stripe/extend-trial', {
        method: 'POST',
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to extend trial');
      }

      toast({
        title: "Success!",
        description: "Your trial has been extended by 7 days!",
      });

      // Refresh page to update trial end date
      window.location.reload();
    } catch (error) {
      console.error('Failed to extend trial:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to extend trial period"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = async (tier: 'starter' | 'pro', isYearly: boolean) => {
    // You'll need to update these with your actual Stripe price IDs
    const priceIds = {
      starter: {
        monthly: 'price_1RKZsdAIJBVVerrJhsQhpig2',
        yearly: 'price_1RKZsdAIJBVVerrJmp9neLDz'
      },
      pro: {
        monthly: 'price_1RFrkBAIJBVVerrJNDRc9xSL', 
        yearly: 'price_1RKZwJAIJBVVerrJjGTuhgbG'
      }
    };

    const priceId = priceIds[tier][isYearly ? 'yearly' : 'monthly'];

    try {
      const response = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ priceId }),
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to create checkout session');
      }

      const { url } = await response.json();
      window.location.href = url;
    } catch (error) {
      console.error('Error creating checkout session:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to start subscription process"
      });
    }
  };

  const subscriptionStatus = getSubscriptionStatus();
  const usageLimits = getUsageLimits();
  const aiUsage = user?.aiInteractionsCount || 0;
  const labUsage = user?.labUploadsCount || 0;

  return (
    <Card className="mb-6">
      <CardHeader className="flex flex-row items-center justify-between py-3">
        <h3 className="text-lg font-semibold">Account Status</h3>
        <div className={`px-2 py-1 rounded-full text-sm ${subscriptionStatus.color}`}>
          {subscriptionStatus.label}
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        {/* Usage Statistics */}
        {subscriptionStatus.tier !== 'free' && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-gray-700">Usage This Period</h4>
            
            {/* AI Interactions */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-blue-500" />
                  <span>AI Interactions</span>
                </div>
                <span className="font-medium">
                  {usageLimits.aiInteractions === Infinity 
                    ? `${aiUsage} / Unlimited` 
                    : `${aiUsage} / ${usageLimits.aiInteractions}`}
                </span>
              </div>
              {usageLimits.aiInteractions !== Infinity && (
                <Progress 
                  value={getUsageProgress(aiUsage, usageLimits.aiInteractions)} 
                  className="h-2" 
                />
              )}
            </div>

            {/* Lab Uploads */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-green-500" />
                  <span>Lab Uploads</span>
                </div>
                <span className="font-medium">
                  {usageLimits.labUploads === Infinity 
                    ? `${labUsage} / Unlimited` 
                    : `${labUsage} / ${usageLimits.labUploads}`}
                </span>
              </div>
              {usageLimits.labUploads !== Infinity && usageLimits.labUploads > 0 && (
                <Progress 
                  value={getUsageProgress(labUsage, usageLimits.labUploads)} 
                  className="h-2" 
                />
              )}
            </div>
          </div>
        )}

        {/* Subscription Info */}
        <div className="space-y-2">
          {subscriptionStatus.tier === 'pro' ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <CreditCardIcon className="w-4 h-4 text-green-600" />
                <span className="font-medium">Pro Subscription Active</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <CalendarIcon className="w-4 h-4" />
                <span>Next billing date: {formatDate(user?.subscriptionEndsAt || null)}</span>
              </div>
            </div>
          ) : subscriptionStatus.tier === 'starter' ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <CreditCardIcon className="w-4 h-4 text-blue-600" />
                <span className="font-medium">Starter Subscription Active</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <CalendarIcon className="w-4 h-4" />
                <span>Next billing date: {formatDate(user?.subscriptionEndsAt || null)}</span>
              </div>
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 text-sm">
                  <CalendarIcon className="w-4 h-4 text-orange-500" />
                  <span className="font-medium">
                    {user?.trialEndsAt ? 
                      `${getRemainingDays(user.trialEndsAt)} days remaining in trial` : 
                      'Trial not started'}
                  </span>
                </div>
                <p className="text-sm text-gray-600">
                  {user?.trialEndsAt ? 
                    'Upgrade now to keep access to all features' :
                    'Start your trial to access all features'}
                </p>
              </div>

              {/* Trial Extension Reward */}
              {streakDays > 0 && (
                <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Award className="w-5 h-5 text-blue-500" />
                    <span className="text-sm font-medium">
                      Logging Streak: {streakDays} days
                    </span>
                  </div>
                  <div className="mt-2">
                    <Progress value={(streakDays / 14) * 100} className="h-2" />
                  </div>
                  {streakDays >= 14 ? (
                    <Button
                      onClick={handleExtendTrial}
                      disabled={loading}
                      className="mt-2 w-full bg-blue-500 hover:bg-blue-600"
                    >
                      {loading ? "Processing..." : "Claim 7 Extra Trial Days!"}
                    </Button>
                  ) : (
                    <p className="text-xs text-gray-600 mt-2">
                      Log your supplements for {14 - streakDays} more days to earn 7 extra trial days!
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Upgrade Options */}
        {subscriptionStatus.tier === 'free' && (
          <div className="space-y-3">
            <div className="text-sm font-medium text-gray-700">Upgrade Plans</div>
            
            {/* Starter Plan */}
            <div className="p-3 border rounded-lg">
              <div className="flex justify-between items-center mb-2">
                <h5 className="font-medium">Starter - AI Essentials</h5>
                <span className="text-sm text-gray-500">100 AI chats, 3 lab uploads</span>
              </div>
              <div className="flex gap-2">
                <Button 
                  size="sm"
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                  onClick={() => handleSubscribe('starter', false)}
                  disabled={loading}
                >
                  ${TIER_PRICING.starter.monthly}/month
                </Button>
                <Button 
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  onClick={() => handleSubscribe('starter', true)}
                  disabled={loading}
                >
                  ${TIER_PRICING.starter.yearly}/year
                </Button>
              </div>
            </div>

            {/* Pro Plan */}
            <div className="p-3 border rounded-lg border-green-200 bg-green-50">
              <div className="flex justify-between items-center mb-2">
                <h5 className="font-medium">Pro - Full Biohacker Suite</h5>
                <span className="text-sm text-green-600 font-medium">Popular</span>
              </div>
              <div className="text-sm text-gray-600 mb-2">Unlimited AI chats & lab uploads</div>
              <div className="flex gap-2">
                <Button 
                  size="sm"
                  className="flex-1 bg-green-600 hover:bg-green-700"
                  onClick={() => handleSubscribe('pro', false)}
                  disabled={loading}
                >
                  ${TIER_PRICING.pro.monthly}/month
                </Button>
                <Button 
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  onClick={() => handleSubscribe('pro', true)}
                  disabled={loading}
                >
                  ${TIER_PRICING.pro.yearly}/year
                </Button>
              </div>
            </div>
          </div>
        )}

        {subscriptionStatus.tier === 'starter' && (
          <div className="space-y-3">
            <div className="p-3 border rounded-lg border-green-200 bg-green-50">
              <div className="flex justify-between items-center mb-2">
                <h5 className="font-medium">Upgrade to Pro</h5>
                <span className="text-sm text-green-600">Unlimited everything</span>
              </div>
              <div className="flex gap-2">
                <Button 
                  size="sm"
                  className="flex-1 bg-green-600 hover:bg-green-700"
                  onClick={() => handleSubscribe('pro', false)}
                  disabled={loading}
                >
                  ${TIER_PRICING.pro.monthly}/month
                </Button>
                <Button 
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  onClick={() => handleSubscribe('pro', true)}
                  disabled={loading}
                >
                  ${TIER_PRICING.pro.yearly}/year
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}