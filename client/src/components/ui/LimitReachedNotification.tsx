
import React from 'react';
import { useLocation } from 'wouter';
import { Alert, AlertTitle, AlertDescription } from './alert';
import { Button } from './button';

interface LimitReachedNotificationProps {
  message: string;
}

const LimitReachedNotification = ({ message }: LimitReachedNotificationProps) => {
  const [, setLocation] = useLocation();

  return (
    <Alert variant="warning" className="mb-4">
      <AlertTitle>Usage Limit Reached</AlertTitle>
      <AlertDescription className="mt-2">
        <p>{message}</p>
        <Button
          onClick={() => setLocation('/subscription-page')}
          variant="outline"
          className="mt-2"
        >
          Upgrade Plan
        </Button>
      </AlertDescription>
    </Alert>
  );
};

export default LimitReachedNotification;
