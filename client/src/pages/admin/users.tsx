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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pencil, Trash2, Loader2, Users, TrendingUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import type { SelectUser } from "@db/schema";
import Header from "@/components/header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type FormData = {
  name: string;
  email: string;
  subscriptionTier: string;
};

type UserWithStats = SelectUser & {
  totalSupplements?: number;
  totalLogs?: number;
  lastActivity?: string;
};

type UserGrowthData = {
  daily: { date: string; count: number }[];
  monthly: { month: string; count: number }[];
  yearly: { year: string; count: number }[];
  totalUsers: number;
  activeUsers: number;
};

export default function AdminUsers() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = React.useState(false);
  const [editingUser, setEditingUser] = React.useState<UserWithStats | null>(null);
  const [selectedTier, setSelectedTier] = React.useState<string>("");

  const form = useForm<FormData>({
    defaultValues: {
      name: "",
      email: "",
      subscriptionTier: "free",
    },
  });

  const { data: users = [], isLoading } = useQuery<UserWithStats[]>({
    queryKey: ['/api/admin/users'],
    queryFn: async () => {
      const res = await fetch('/api/admin/users');
      if (!res.ok) {
        console.error('Failed to fetch users:', await res.text());
        throw new Error('Failed to fetch users');
      }
      const data = await res.json();
      console.log('Fetched users:', data);
      return data;
    }
  });

  const { data: growthData, isLoading: isGrowthLoading } = useQuery<UserGrowthData>({
    queryKey: ['/api/admin/users/growth'],
    queryFn: async () => {
      const res = await fetch('/api/admin/users/growth');
      if (!res.ok) {
        console.error('Failed to fetch user growth data:', await res.text());
        throw new Error('Failed to fetch user growth data');
      }
      const data = await res.json();
      console.log('Fetched user growth data:', data);
      return data;
    }
  });

  const updateUser = useMutation({
    mutationFn: async (data: FormData & { id: number }) => {
      const res = await fetch(`/api/admin/users/${data.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name,
          email: data.email,
          subscriptionTier: data.subscriptionTier,
        }),
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      toast({ title: "Success", description: "User updated successfully" });
      setOpen(false);
      setEditingUser(null);
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

  const deleteUser = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users/growth'] });
      toast({ title: "Success", description: "User deleted successfully" });
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
    if (editingUser) {
      updateUser.mutate({ ...data, id: editingUser.id });
    }
  };

  const handleEdit = (user: UserWithStats) => {
    setEditingUser(user);
    form.reset({
      name: user.name || '',
      email: user.email,
      subscriptionTier: user.subscriptionTier,
    });
    setSelectedTier(user.subscriptionTier);
    setOpen(true);
  };

  const handleDelete = (id: number) => {
    if (confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      deleteUser.mutate(id);
    }
  };

  const handleCloseDialog = () => {
    setOpen(false);
    setEditingUser(null);
    setSelectedTier("");
    form.reset();
  };

  const getSubscriptionBadgeVariant = (tier: string) => {
    switch (tier) {
      case 'pro':
        return 'default';
      case 'premium':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
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
          <h1 className="text-2xl font-bold">User Management</h1>
        </div>

        {/* User Growth Stats */}
        {growthData && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{growthData.totalUsers}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Users</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{growthData.activeUsers}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">This Month</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {growthData.monthly[growthData.monthly.length - 1]?.count || 0}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">This Year</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {growthData.yearly[growthData.yearly.length - 1]?.count || 0}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <Dialog open={open} onOpenChange={handleCloseDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit User</DialogTitle>
              <DialogDescription>
                Update user information and subscription tier.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  {...form.register("name")}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  {...form.register("email")}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="subscriptionTier">Subscription Tier</Label>
                <Select 
                  value={selectedTier} 
                  onValueChange={(value) => {
                    setSelectedTier(value);
                    form.setValue("subscriptionTier", value);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select subscription tier" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="free">Free</SelectItem>
                    <SelectItem value="pro">Pro</SelectItem>
                    <SelectItem value="premium">Premium</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={updateUser.isPending}
              >
                {updateUser.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Update User
              </Button>
            </form>
          </DialogContent>
        </Dialog>

        <Table>
          <TableCaption>A list of all users in the system.</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Subscription</TableHead>
              <TableHead>Signup Date</TableHead>
              <TableHead>Supplements</TableHead>
              <TableHead>Last Activity</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="font-medium">{user.name || 'N/A'}</TableCell>
                <TableCell>{user.email}</TableCell>
                <TableCell>
                  <Badge variant={getSubscriptionBadgeVariant(user.subscriptionTier)}>
                    {user.subscriptionTier.toUpperCase()}
                  </Badge>
                </TableCell>
                <TableCell>{formatDate(user.createdAt.toString())}</TableCell>
                <TableCell>{user.totalSupplements || 0}</TableCell>
                <TableCell>
                  {user.lastActivity ? formatDate(user.lastActivity) : 'Never'}
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => handleEdit(user)}
                      title="Edit user"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="text-destructive"
                      onClick={() => handleDelete(user.id)}
                      disabled={deleteUser.isPending || user.isAdmin}
                      title={user.isAdmin ? "Cannot delete admin user" : "Delete user"}
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