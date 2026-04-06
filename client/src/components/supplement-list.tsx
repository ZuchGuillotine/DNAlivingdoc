import { useSupplements } from "@/hooks/use-supplements";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Trash2, Pencil, Save } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import SupplementForm from "./supplement-form";
import { useState, useEffect } from "react";
import React from "react";
import { Link } from "wouter";

/**
 * SupplementList Component
 * Displays a grid of supplement cards with tracking functionality.
 * Allows users to mark supplements as taken/not taken and save their daily intake.
 */
export default function SupplementList() {
  // Custom hook for supplement CRUD operations
  const { supplements, isLoading, deleteSupplement, updateSupplement } = useSupplements();

  // State management for editing supplements and UI controls
  const [editingSupplement, setEditingSupplement] = useState<number | null>(null);
  const [showSaveConfirmation, setShowSaveConfirmation] = useState(false);

  // Track which supplements have been marked as taken
  const [supplementStates, setSupplementStates] = useState<Record<number, { taken: boolean }>>({});
  const { toast } = useToast();

  /**
   * Effect hook to initialize and maintain supplement states
   * Also handles daily reminder notification logic
   */
  // Track if notification has been shown
  const [notificationShown, setNotificationShown] = useState(false);

  useEffect(() => {
    // Create a new state object for tracking supplement intake
    const newStates = supplements.reduce((acc, supplement) => {
      if (!supplementStates[supplement.id]) {
        acc[supplement.id] = { taken: true }; // Default to taken
      } else {
        acc[supplement.id] = supplementStates[supplement.id];
      }
      return acc;
    }, {} as Record<number, { taken: boolean }>);

    if (JSON.stringify(newStates) !== JSON.stringify(supplementStates)) {
      setSupplementStates(newStates);
    }
  }, [supplements, supplementStates]);

  // Separate effect for notification to better control when it runs
  useEffect(() => {
    // Daily reminder notification logic
    // Shows notification if supplements haven't been logged for the current calendar day
    const today = new Date().toISOString().split('T')[0];
    const lastLoggedDate = localStorage.getItem('lastSupplementLogDate');

    if (today !== lastLoggedDate && supplements.length > 0 && !notificationShown) {
      toast({
        title: "Daily Supplement Log Reminder",
        description: "Don't forget to log your supplements for today!",
        duration: 5000,
      });
      setNotificationShown(true);
    }
  }, [supplements.length, toast, notificationShown]);

  /**
   * Handles saving the daily supplement intake log
   * Creates log entries for supplements marked as taken
   * Preserves the exact timestamp when supplements were taken
   */
  const handleSaveChanges = async () => {
    try {
      // Filter supplements marked as taken
      const takenSupplements = supplements.filter(supp => supplementStates[supp.id]?.taken);

      console.log('Preparing to save supplement logs:', {
        supplementCount: takenSupplements.length,
        clientTime: new Date().toISOString(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
      });

      // Prepare log entries with precise timestamp preservation
      const logsToSave = takenSupplements.map(supplement => {
        const now = new Date();
        return {
          supplementId: supplement.id,
          userId: null, // Set by server based on session
          takenAt: now.toISOString(), // Preserve actual time of intake
          dosage: supplement.dosage,
          frequency: supplement.frequency,
          name: supplement.name,
        };
      });

      // Send logs to server
      const response = await fetch('/api/supplement-logs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          logs: logsToSave
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || 'Failed to save supplement logs');
      }

      const savedLogs = await response.json();
      console.log('Successfully saved logs:', {
        count: savedLogs.length,
        timestamp: new Date().toISOString(),
        sampleLog: savedLogs[0] ? {
          id: savedLogs[0].id,
          takenAt: savedLogs[0].takenAt,
          dateOnly: new Date(savedLogs[0].takenAt).toISOString().split('T')[0]
        } : null
      });

      // Update UI and store last logged date
      setShowSaveConfirmation(false);
      const today = new Date().toISOString().split('T')[0];
      localStorage.setItem('lastSupplementLogDate', today);

      toast({
        title: "Success",
        description: "Your supplement intake has been logged successfully.",
      });
    } catch (error) {
      console.error('Error saving changes:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
      });

      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save your supplement intake. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Show loading state while fetching supplements
  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Show empty state when no supplements are added
  if (supplements.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No supplements added yet.
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      {/* Supplement Cards Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {supplements.map((supplement) => (
          <Card key={supplement.id}>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle>{supplement.name}</CardTitle>
                  <CardDescription>
                    {supplement.dosage} • {supplement.frequency}
                  </CardDescription>
                </div>
                {/* Supplement Action Buttons */}
                <div className="flex flex-col gap-2">
                  {/* Edit Button */}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setEditingSupplement(supplement.id)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  {/* Delete Confirmation Dialog */}
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Supplement</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to delete this supplement? This action
                          cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => deleteSupplement(supplement.id)}
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* Optional supplement notes */}
              {supplement.notes && <p className="text-sm mb-4">{supplement.notes}</p>}
              {/* Taken/Not taken toggle switch */}
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Did you take this today?</span>
                <Switch
                  checked={supplementStates[supplement.id]?.taken ?? true}
                  onCheckedChange={(checked) => {
                    setSupplementStates(prev => ({
                      ...prev,
                      [supplement.id]: { taken: checked }
                    }));
                  }}
                />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Bottom Action Bar */}
      <div className="mt-6 flex justify-between">
        {/* History Link */}
        <Link href="/supplement-history">
          <Button className="bg-white text-[#1b4332] hover:bg-white/90">
            My History
          </Button>
        </Link>
        {/* Save Changes Dialog */}
        <AlertDialog open={showSaveConfirmation} onOpenChange={setShowSaveConfirmation}>
          <AlertDialogTrigger asChild>
            <Button className="bg-white text-[#1b4332] hover:bg-white/90">
              Save Today
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Save Changes</AlertDialogTitle>
              <AlertDialogDescription>
                Do you want to update your supplement tracking information? This will
                record your supplement intake for today.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleSaveChanges}>
                Save
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* Edit Supplement Dialog */}
      <Dialog
        open={editingSupplement !== null}
        onOpenChange={(open) => !open && setEditingSupplement(null)}
      >
        <DialogContent className="bg-[#1b4332] text-white">
          <DialogHeader>
            <DialogTitle>Edit Supplement</DialogTitle>
          </DialogHeader>
          {editingSupplement && (
            <SupplementForm
              supplementId={editingSupplement}
              onSuccess={() => setEditingSupplement(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}