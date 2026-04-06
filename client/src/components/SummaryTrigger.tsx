
// client/src/components/SummaryTrigger.tsx

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Loader2, CalendarIcon, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface SummaryTriggerProps {
  className?: string;
  onSummaryGenerated?: (summary: any) => void;
}

export default function SummaryTrigger({ className, onSummaryGenerated }: SummaryTriggerProps) {
  const [loading, setLoading] = useState(false);
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [open, setOpen] = useState(false);
  const [generatedSummary, setGeneratedSummary] = useState<any>(null);
  const { toast } = useToast();

  const triggerDailySummary = async () => {
    if (!date) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please select a date",
      });
      return;
    }

    setLoading(true);
    
    try {
      const response = await fetch("/api/summaries/daily", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ date: date.toISOString() }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate summary");
      }

      const data = await response.json();
      
      if (data.summary) {
        setGeneratedSummary(data.summary);
        if (onSummaryGenerated) {
          onSummaryGenerated(data.summary);
        }
        
        toast({
          title: "Success",
          description: "Summary generated successfully",
        });
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: data.message || "No data available for summary generation",
        });
      }
    } catch (error) {
      console.error("Error generating summary:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to generate summary",
      });
    } finally {
      setLoading(false);
    }
  };

  const triggerRealtimeSummary = async () => {
    setLoading(true);
    
    try {
      const response = await fetch("/api/summaries/realtime", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        }
      });

      if (!response.ok) {
        throw new Error("Failed to trigger summarization");
      }

      const data = await response.json();
      
      if (data.success) {
        toast({
          title: "Success",
          description: "Real-time summarization triggered successfully",
        });
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: data.message || "Failed to trigger summarization",
        });
      }
    } catch (error) {
      console.error("Error triggering summarization:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to trigger summarization",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={className}>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" className="w-full">
            <RefreshCw className="mr-2 h-4 w-4" />
            Generate Summary
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Generate Summary</DialogTitle>
            <DialogDescription>
              Select a date to generate a daily summary or trigger real-time summarization.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="flex flex-col items-center gap-4">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "w-[280px] justify-start text-left font-normal",
                      !date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? format(date, "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={setDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              
              {generatedSummary && (
                <Card className="w-full">
                  <CardHeader>
                    <CardTitle>Generated Summary</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="whitespace-pre-wrap text-sm">
                      {generatedSummary.content}
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={triggerRealtimeSummary} disabled={loading}>
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Run Real-time Summary
            </Button>
            <Button onClick={triggerDailySummary} disabled={loading}>
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                "Generate Daily Summary"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
