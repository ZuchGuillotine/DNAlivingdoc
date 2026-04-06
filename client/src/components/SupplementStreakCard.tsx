
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useEffect, useState } from "react";

export default function SupplementStreakCard() {
  const [streak, setStreak] = useState(0);
  const [progress, setProgress] = useState(0);
  const maxStreak = 90;

  useEffect(() => {
    // Fetch streak data
    const fetchStreak = async () => {
      try {
        const response = await fetch('/api/supplement-streak');
        const data = await response.json();
        setStreak(data.currentStreak);
        setProgress((data.currentStreak / maxStreak) * 100);
      } catch (error) {
        console.error('Error fetching streak:', error);
      }
    };

    fetchStreak();
  }, []);

  return (
    <Card className="w-full mb-6">
      <CardContent className="pt-6">
        <div className="flex flex-col space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-xl font-semibold">Supplement Logging Streak</h3>
            <span className="text-lg font-medium">{streak} / {maxStreak} days</span>
          </div>
          <Progress value={progress} className="h-2" />
          <p className="text-sm text-muted-foreground">
            {streak === 0 
              ? "Start your streak by logging your supplements today!"
              : `Keep going! You're ${maxStreak - streak} days away from your 90-day goal!`}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
