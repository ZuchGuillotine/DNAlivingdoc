import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent } from './ui/card';
import { useLocation } from 'wouter';
import { useToast } from '@/hooks/use-toast';
import { SubscriptionCheck } from './SubscriptionCheck';

interface SignupFormProps {
  onSignup?: (data: any) => void;
}

export function SignupForm({ onSignup }: SignupFormProps) {
  const { register, handleSubmit, formState: { errors } } = useForm();
  const [isLoading, setIsLoading] = useState(false);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const { toast } = useToast();

  const onSubmit = async (data: any) => {
    setIsLoading(true);
    try {
      console.log('Starting signup process');

      // Call signup API endpoint
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Important for session cookie
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Signup failed');
      }

      const result = await response.json();
      console.log('Signup successful, showing subscription modal');

      // For free tier signups, show payment options modal
      setShowSubscriptionModal(true);

      // Call onSignup callback if provided
      if (onSignup) {
        onSignup(result);
      }

    } catch (error: any) {
      console.error('Signup error:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || 'Failed to create account',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <Input
                placeholder="Email"
                {...register('email', { 
                  required: 'Email is required', 
                  pattern: { 
                    value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i, 
                    message: 'Invalid email address' 
                  } 
                })}
                className="w-full"
              />
              {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email.message?.toString()}</p>}
            </div>

            <div>
              <Input
                type="password"
                placeholder="Password"
                {...register('password', { 
                  required: 'Password is required', 
                  minLength: { 
                    value: 8, 
                    message: 'Password must be at least 8 characters' 
                  } 
                })}
                className="w-full"
              />
              {errors.password && <p className="text-red-500 text-sm mt-1">{errors.password.message?.toString()}</p>}
            </div>

            <div>
              <Input
                placeholder="Username"
                {...register('username', { required: 'Username is required' })}
                className="w-full"
              />
              {errors.username && <p className="text-red-500 text-sm mt-1">{errors.username.message?.toString()}</p>}
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? 'Creating Account...' : 'Sign Up'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {showSubscriptionModal && (
        <SubscriptionCheck 
          showAsModal={true}
          reason="signup"
        />
      )}
    </>
  );
}