
import { Fragment } from "react";
import { Link } from "wouter";
import Header from "@/components/header";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function AdminDashboard() {
  return (
    <Fragment>
      <Header />
      <main className="container mx-auto py-12 px-4">
        <h1 className="text-4xl font-bold mb-8 text-primary">Admin Dashboard</h1>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Link href="/admin/blog">
            <Card className="cursor-pointer hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle>Blog Management</CardTitle>
                <CardDescription>Create, edit, and manage blog posts</CardDescription>
              </CardHeader>
            </Card>
          </Link>
          <Link href="/admin/supplements">
            <Card className="cursor-pointer hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle>Supplement Reference</CardTitle>
                <CardDescription>Manage supplement reference database</CardDescription>
              </CardHeader>
            </Card>
          </Link>
          <Link href="/admin/users">
            <Card className="cursor-pointer hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle>User Management</CardTitle>
                <CardDescription>Manage users, subscriptions, and view growth analytics</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        </div>
      </main>
    </Fragment>
  );
}
