
import { useForm } from "react-hook-form";
import { useSupplements } from "@/hooks/use-supplements";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { SupplementSearch } from "./supplement-search";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import cn from 'classnames';

/**
 * Type definition for form data structure
 * Defines the shape of data collected from the supplement form
 */
type FormData = {
  name: string;                // Name of the supplement
  dosageAmount: string;        // Numerical value of dosage
  dosageUnit: string;         // Unit of measurement for dosage (e.g., mg, g)
  frequencyAmount: string;    // How often the supplement is taken (numerical)
  frequencyUnit: string;      // Time unit for frequency (e.g., daily, weekly)
  notes?: string;            // Optional notes about the supplement
};

/**
 * Interface for SupplementForm component props
 */
interface SupplementFormProps {
  supplementId?: number;     // Optional ID for editing existing supplements
  onSuccess: () => void;    // Callback function executed after successful form submission
}

/**
 * SupplementForm Component
 * Handles both creation and editing of supplements
 * 
 * @param supplementId - Optional ID of supplement being edited
 * @param onSuccess - Callback function after successful submission
 */
export default function SupplementForm({
  supplementId,
  onSuccess
}: SupplementFormProps) {
  // Custom hooks for supplement management, notifications, and responsive design
  const { addSupplement, updateSupplement, supplements } = useSupplements();
  const { toast } = useToast();
  const isMobile = useIsMobile();

  // Find existing supplement data if editing mode
  const existingSupplement = supplementId 
    ? supplements.find(s => s.id === supplementId)
    : null;

  /**
   * Parses dosage string into amount and unit
   * Example: "500 mg" -> { amount: "500", unit: "mg" }
   */
  const parseDosage = (dosage?: string) => {
    if (!dosage) return { amount: "1", unit: "mg" };
    const match = dosage.match(/(\d+)\s*(\w+)/);
    return {
      amount: match?.[1] || "1",
      unit: match?.[2] || "mg"
    };
  };

  /**
   * Parses frequency string into amount and unit
   * Example: "2x daily" -> { amount: "2", unit: "daily" }
   */
  const parseFrequency = (frequency?: string) => {
    if (!frequency) return { amount: "1", unit: "daily" };
    const match = frequency.match(/(\d+)x\s*(\w+)/);
    return {
      amount: match?.[1] || "1",
      unit: match?.[2] || "daily"
    };
  };

  // Parse existing supplement data if in edit mode
  const existingDosage = parseDosage(existingSupplement?.dosage);
  const existingFrequency = parseFrequency(existingSupplement?.frequency);

  // Initialize form with react-hook-form
  const form = useForm<FormData>({
    defaultValues: {
      name: existingSupplement?.name || "",
      dosageAmount: existingDosage.amount,
      dosageUnit: existingDosage.unit,
      frequencyAmount: existingFrequency.amount,
      frequencyUnit: existingFrequency.unit,
      notes: existingSupplement?.notes || "",
    },
  });

  /**
   * Form submission handler
   * Processes form data and calls appropriate API endpoints
   */
  const onSubmit = async (data: FormData) => {
    try {
      // Construct supplement data object
      const supplementData = {
        name: data.name,
        dosage: `${data.dosageAmount} ${data.dosageUnit}`,
        frequency: `${data.frequencyAmount}x ${data.frequencyUnit}`,
        notes: data.notes,
      };

      // Update existing or create new supplement based on supplementId
      if (supplementId) {
        await updateSupplement({ id: supplementId, data: supplementData });
        toast({
          title: "Success",
          description: "Supplement updated successfully",
        });
      } else {
        await addSupplement(supplementData);
        toast({
          title: "Success",
          description: "Supplement added successfully",
        });
      }
      onSuccess();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    }
  };

  // Responsive styling classes
  const inputClassName = isMobile ? "h-12 text-base" : "h-10 text-sm";
  const selectClassName = isMobile ? "h-12" : "h-10";

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      {/* Supplement Name Field */}
      <div className="space-y-2">
        <Label htmlFor="name" className="text-sm font-medium text-white">
          Supplement Name
        </Label>
        <SupplementSearch
          value={form.watch("name")}
          onChange={(value) => form.setValue("name", value)}
          className={inputClassName}
        />
      </div>

      {/* Dosage Selection Fields */}
      <div className="space-y-2">
        <Label htmlFor="dosage" className="text-sm font-medium text-white">
          Dosage
        </Label>
        <div className="flex gap-3">
          {/* Dosage Amount Dropdown */}
          <Select
            defaultValue={form.getValues("dosageAmount")}
            onValueChange={(value) => form.setValue("dosageAmount", value)}
          >
            <SelectTrigger className={cn("bg-white text-[#1b4332] flex-1", selectClassName)}>
              <SelectValue placeholder="Amount" />
            </SelectTrigger>
            <SelectContent className="max-h-60">
              {(() => {
                const unit = form.watch("dosageUnit");
                
                if (unit === "mg") {
                  // mg: 50-1000 in multiples of 50
                  return [...Array(20)].map((_, i) => (
                    <SelectItem key={i} value={(50 * (i + 1)).toString()}>
                      {50 * (i + 1)}
                    </SelectItem>
                  ));
                } else if (unit === "mcg") {
                  // mcg: 50-1000 in multiples of 50
                  return [...Array(20)].map((_, i) => (
                    <SelectItem key={i} value={(50 * (i + 1)).toString()}>
                      {50 * (i + 1)}
                    </SelectItem>
                  ));
                } else if (unit === "IU") {
                  // IU: 50-2000 in multiples of 50
                  return [...Array(40)].map((_, i) => (
                    <SelectItem key={i} value={(50 * (i + 1)).toString()}>
                      {50 * (i + 1)}
                    </SelectItem>
                  ));
                } else {
                  // g: 1-10
                  return [...Array(10)].map((_, i) => (
                    <SelectItem key={i + 1} value={(i + 1).toString()}>
                      {i + 1}
                    </SelectItem>
                  ));
                }
              })()}
            </SelectContent>
          </Select>
          {/* Dosage Unit Dropdown */}
          <Select
            defaultValue={form.getValues("dosageUnit")}
            onValueChange={(value) => {
              form.setValue("dosageUnit", value);
              // Reset dosage amount to appropriate default when unit changes
              if (value === "mg") {
                form.setValue("dosageAmount", "50");
              } else if (value === "mcg") {
                form.setValue("dosageAmount", "50");
              } else if (value === "IU") {
                form.setValue("dosageAmount", "50");
              } else {
                form.setValue("dosageAmount", "1");
              }
            }}
          >
            <SelectTrigger className={cn("bg-white text-[#1b4332] flex-1", selectClassName)}>
              <SelectValue placeholder="Unit" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="mg">mg</SelectItem>
              <SelectItem value="g">g</SelectItem>
              <SelectItem value="mcg">mcg</SelectItem>
              <SelectItem value="IU">IU</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Frequency Selection Fields */}
      <div className="space-y-2">
        <Label htmlFor="frequency" className="text-sm font-medium text-white">
          Frequency
        </Label>
        <div className="flex gap-3">
          {/* Frequency Amount Dropdown */}
          <Select
            defaultValue={form.getValues("frequencyAmount")}
            onValueChange={(value) => form.setValue("frequencyAmount", value)}
          >
            <SelectTrigger className={cn("bg-white text-[#1b4332] flex-1", selectClassName)}>
              <SelectValue placeholder="Amount" />
            </SelectTrigger>
            <SelectContent className="max-h-60">
              {[...Array(14)].map((_, i) => (
                <SelectItem key={i + 1} value={(i + 1).toString()}>
                  {i + 1}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {/* Frequency Unit Dropdown */}
          <Select
            defaultValue={form.getValues("frequencyUnit")}
            onValueChange={(value) => form.setValue("frequencyUnit", value)}
          >
            <SelectTrigger className={cn("bg-white text-[#1b4332] flex-1", selectClassName)}>
              <SelectValue placeholder="Unit" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="hourly">hourly</SelectItem>
              <SelectItem value="daily">daily</SelectItem>
              <SelectItem value="weekly">weekly</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Optional Notes Field */}
      <div className="space-y-2">
        <Label htmlFor="notes" className="text-sm font-medium text-white">
          Notes
        </Label>
        <Textarea 
          id="notes" 
          {...form.register("notes")} 
          className={cn(
            "bg-white text-[#1b4332] placeholder:text-[#1b4332]/60",
            isMobile ? "min-h-[100px] text-base" : "min-h-[80px] text-sm"
          )}
        />
      </div>

      {/* Submit Button */}
      <Button
        type="submit"
        className={cn(
          "w-full bg-white text-[#1b4332] hover:bg-white/90",
          isMobile ? "h-14 text-lg" : "h-10 text-sm"
        )}
        disabled={form.formState.isSubmitting}
      >
        {form.formState.isSubmitting && (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        )}
        {supplementId ? 'Update Supplement' : 'Add Supplement'}
      </Button>
    </form>
  );
}
