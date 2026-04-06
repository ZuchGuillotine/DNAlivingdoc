import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import type { SelectSupplementReference, InsertSupplementReference } from "@db/schema";
import Header from "@/components/header";

type FormData = {
  name: string;
  category: string;
  alternativeNames: string;
  description: string;
  source: string;
  sourceUrl: string;
};

export default function AdminSupplements() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = React.useState(false);
  const [editingSupplement, setEditingSupplement] = React.useState<SelectSupplementReference | null>(null);

  const form = useForm<FormData>({
    defaultValues: {
      name: "",
      category: "",
      alternativeNames: "",
      description: "",
      source: "",
      sourceUrl: "",
    },
  });

  const { data: supplements = [], isLoading } = useQuery<SelectSupplementReference[]>({
    queryKey: ['/api/admin/supplements'],
    queryFn: async () => {
      const res = await fetch('/api/admin/supplements');
      if (!res.ok) {
        console.error('Failed to fetch supplements:', await res.text());
        throw new Error('Failed to fetch supplements');
      }
      const data = await res.json();
      console.log('Fetched supplements:', data);
      return data;
    }
  });

  const addSupplement = useMutation({
    mutationFn: async (data: FormData) => {
      const supplement: Partial<InsertSupplementReference> = {
        name: data.name,
        category: data.category,
        alternativeNames: data.alternativeNames.split(',').map(name => name.trim()),
        description: data.description,
        source: data.source,
        sourceUrl: data.sourceUrl,
      };

      const res = await fetch('/api/admin/supplements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(supplement),
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/supplements'] });
      toast({ title: "Success", description: "Supplement added successfully" });
      setOpen(false);
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    },
  });

  const updateSupplement = useMutation({
    mutationFn: async (data: FormData) => {
      if (!editingSupplement) throw new Error('No supplement selected for editing');
      
      const supplement: Partial<InsertSupplementReference> = {
        name: data.name,
        category: data.category,
        alternativeNames: data.alternativeNames.split(',').map(name => name.trim()),
        description: data.description,
        source: data.source,
        sourceUrl: data.sourceUrl,
      };

      const res = await fetch(`/api/admin/supplements/${editingSupplement.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(supplement),
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/supplements'] });
      toast({ title: "Success", description: "Supplement updated successfully" });
      setOpen(false);
      setEditingSupplement(null);
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    },
  });

  const deleteSupplement = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/admin/supplements/${id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/supplements'] });
      toast({ title: "Success", description: "Supplement deleted successfully" });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    },
  });

  const onSubmit = (data: FormData) => {
    if (editingSupplement) {
      updateSupplement.mutate(data);
    } else {
      addSupplement.mutate(data);
    }
  };

  const handleEdit = (supplement: SelectSupplementReference) => {
    setEditingSupplement(supplement);
    form.reset({
      name: supplement.name,
      category: supplement.category,
      alternativeNames: supplement.alternativeNames?.join(', ') || '',
      description: supplement.description || '',
      source: supplement.source || '',
      sourceUrl: supplement.sourceUrl || '',
    });
    setOpen(true);
  };

  const handleDelete = (id: number) => {
    if (confirm('Are you sure you want to delete this supplement?')) {
      deleteSupplement.mutate(id);
    }
  };

  const handleCloseDialog = () => {
    setOpen(false);
    setEditingSupplement(null);
    form.reset();
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Manage Supplements</h1>
          <Dialog open={open} onOpenChange={handleCloseDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Supplement
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingSupplement ? 'Edit Supplement' : 'Add New Supplement'}</DialogTitle>
                <DialogDescription>
                  {editingSupplement ? 'Update the supplement information.' : 'Add a new supplement to the reference database.'}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    {...form.register("name")}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Input
                    id="category"
                    {...form.register("category")}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="alternativeNames">
                    Alternative Names (comma-separated)
                  </Label>
                  <Input
                    id="alternativeNames"
                    {...form.register("alternativeNames")}
                    placeholder="e.g., Vitamin C, Ascorbic Acid"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    {...form.register("description")}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="source">Source</Label>
                  <Input
                    id="source"
                    {...form.register("source")}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="sourceUrl">Source URL</Label>
                  <Input
                    id="sourceUrl"
                    type="url"
                    {...form.register("sourceUrl")}
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={addSupplement.isPending || updateSupplement.isPending}
                >
                  {(addSupplement.isPending || updateSupplement.isPending) && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {editingSupplement ? 'Update Supplement' : 'Add Supplement'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Table>
          <TableCaption>A list of all available supplements in the database.</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Alternative Names</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {supplements.map((supplement) => (
              <TableRow key={supplement.id}>
                <TableCell className="font-medium">{supplement.name}</TableCell>
                <TableCell>{supplement.category}</TableCell>
                <TableCell>{supplement.alternativeNames?.join(', ')}</TableCell>
                <TableCell className="max-w-md truncate">{supplement.description}</TableCell>
                <TableCell>{supplement.source}</TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => handleEdit(supplement)}
                      title="Edit supplement"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="text-destructive"
                      onClick={() => handleDelete(supplement.id)}
                      disabled={deleteSupplement.isPending}
                      title="Delete supplement"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </main>
    </div>
  );
}