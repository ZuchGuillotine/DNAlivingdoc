import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Loader2 } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { getTierFromPriceId } from '@/lib/stripe-price-ids';
import Footer from '@/components/footer';
import Header from '@/components/header';

// Form validation schema
const formSchema = z.object({
  username: z
    .string()
    .min(3, { message: 'Username must be at least 3 characters' })
    .max(50, { message: 'Username must be less than 50 characters' }),
  email: z.string().email({ message: 'Please enter a valid email address' }),
  password: z
    .string()
    .min(8, { message: 'Password must be at least 8 characters' })
    .max(100, { message: 'Password must be less than 100 characters' }),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

export default function PaymentSuccess() {
  const [location, navigate] = useLocation();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [sessionData, setSessionData] = useState<null | {
    sessionId: string;
    priceId: string;
    subscriptionTier: 'free' | 'starter' | 'pro';
  }>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      username: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  });

  // Get the session_id query parameter from the URL
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const sessionId = searchParams.get('session_id');

    if (!sessionId) {
      toast({
        title: 'Error',
        description: 'No payment session ID found. Please try again.',
        variant: 'destructive',
      });
      navigate('/');
      return;
    }

    // Fetch session details from our backend
    const fetchSession = async () => {
      try {
        const response = await apiRequest(
          'GET',
          `/api/stripe/checkout-session/${sessionId}`
        );
        
        if (!response.ok) {
          throw new Error('Failed to verify payment session');
        }

        const data = await response.json();
        
        // Pre-fill the email field if available from Stripe
        if (data.customerEmail) {
          form.setValue('email', data.customerEmail);
        }

        // Determine subscription tier from the price ID
        const tier = getTierFromPriceId(data.priceId);
        
        setSessionData({
          sessionId,
          priceId: data.priceId,
          subscriptionTier: tier,
        });
      } catch (error) {
        console.error('Error verifying payment session:', error);
        toast({
          title: 'Error',
          description: 'Unable to verify your payment. Please contact support.',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchSession();
  }, [navigate, toast, form]);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!sessionData) return;

    try {
      setIsLoading(true);
      
      // Create user account with payment information
      const response = await apiRequest('POST', '/api/post-payment/register', {
        username: values.username,
        email: values.email,
        password: values.password,
        sessionId: sessionData.sessionId,
        subscriptionTier: sessionData.subscriptionTier,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create account');
      }

      // Success - show toast and redirect to dashboard
      toast({
        title: 'Account created!',
        description: 'Welcome to StackTracker! You are now logged in.',
      });
      
      // Redirect to dashboard
      navigate('/dashboard');
    } catch (error: any) {
      toast({
        title: 'Account creation failed',
        description: error.message || 'An unexpected error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 container max-w-6xl py-8">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold">Payment Successful!</h1>
          <p className="mt-4 text-xl">Complete your account setup to get started</p>
        </div>

        {isLoading ? (
          <div className="flex justify-center items-center py-16">
            <LoadingSpinner size="lg" />
            <span className="ml-3">Verifying your payment...</span>
          </div>
        ) : (
          <div className="max-w-md mx-auto">
            <div className="bg-card text-card-foreground rounded-lg border shadow-sm p-6">
              <div className="mb-6">
                <h2 className="text-2xl font-semibold">Create your account</h2>
                <p className="text-muted-foreground">
                  Set up your StackTracker account to access your subscription
                </p>
              </div>

              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="username"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Username</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter username" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input 
                            type="email" 
                            placeholder="Enter email" 
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Password</FormLabel>
                        <FormControl>
                          <Input 
                            type="password" 
                            placeholder="Create password" 
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Confirm Password</FormLabel>
                        <FormControl>
                          <Input 
                            type="password" 
                            placeholder="Confirm password" 
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button 
                    type="submit" 
                    className="w-full" 
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating account...
                      </>
                    ) : (
                      'Complete Setup'
                    )}
                  </Button>
                </form>
              </Form>
            </div>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}