import { useState } from "react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Circle, X, Upload } from "lucide-react";
import { useProfileCompletion } from "@/hooks/use-profile-completion";
import { Button } from "@/components/ui/button";

export function ProfileProgress() {
  const { steps, completionPercentage, isLoading } = useProfileCompletion();
  const [dismissed, setDismissed] = useState(false);

  if (isLoading || dismissed || completionPercentage === 100) return null;

  return (
    <Card className="bg-[#1b4332] text-white relative">
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-2 right-2 text-white/70 hover:text-white hover:bg-[#1b4332]/80"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss profile completion card"
      >
        <X className="h-4 w-4" />
      </Button>
      <CardContent className="pt-6">
        <div className="mb-4">
          <h3 className="text-lg font-semibold mb-2">Profile Completion</h3>
          <Progress value={completionPercentage} className="h-2 bg-white/20" />
          <p className="text-sm mt-2 text-white/70">
            {completionPercentage}% Complete
          </p>
        </div>

        <div className="space-y-4">
          {steps.map((step) => (
            <div
              key={step.id}
              className={cn(
                "flex items-start gap-3 p-3 rounded-lg transition-colors",
                step.completed
                  ? "bg-white/10"
                  : "bg-white/5 hover:bg-white/10"
              )}
            >
              {step.completed ? (
                <CheckCircle2 className="h-5 w-5 text-green-400 mt-0.5" />
              ) : (
                <Circle className="h-5 w-5 text-white/70 mt-0.5" />
              )}
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-medium">{step.label}</h4>
                  {step.completed ? (
                    <Badge className="bg-green-500/20 text-green-300 hover:bg-green-500/30">
                      Completed
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="bg-white/10 text-white hover:bg-white/20"
                    >
                      Todo
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-white/70 mt-0.5">
                  {step.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}