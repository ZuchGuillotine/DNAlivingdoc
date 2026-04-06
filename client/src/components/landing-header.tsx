import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useUser } from "@/hooks/use-user";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Home, BookOpen, Info, HelpCircle, FileText, Search, Menu } from "lucide-react";

export default function LandingHeader() {
  const { user } = useUser();

  return (
    <header className="border-b bg-background relative z-10">
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <div className="flex items-center gap-2 cursor-pointer">
                <Menu className="h-5 w-5 text-primary" />
                <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                  StackTracker
                </h1>
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {user ? (
                <Link href="/">
                  <DropdownMenuItem className="cursor-pointer">
                    <Home className="mr-2 h-4 w-4" />
                    <span>Dashboard</span>
                  </DropdownMenuItem>
                </Link>
              ) : (
                <Link href="/signup">
                  <DropdownMenuItem className="cursor-pointer">
                    <Home className="mr-2 h-4 w-4" />
                    <span>Sign Up</span>
                  </DropdownMenuItem>
                </Link>
              )}
              <Link href="/learn">
                <DropdownMenuItem className="cursor-pointer">
                  <BookOpen className="mr-2 h-4 w-4" />
                  <span>Blog</span>
                </DropdownMenuItem>
              </Link>
              <Link href="/ask">
                <DropdownMenuItem className="cursor-pointer">
                  <HelpCircle className="mr-2 h-4 w-4" />
                  <span>Ask ST</span>
                </DropdownMenuItem>
              </Link>
              <Link href="/research">
                <DropdownMenuItem className="cursor-pointer">
                  <FileText className="mr-2 h-4 w-4" />
                  <span>Research</span>
                </DropdownMenuItem>
              </Link>
              <Link href="/about">
                <DropdownMenuItem className="cursor-pointer">
                  <Info className="mr-2 h-4 w-4" />
                  <span>About</span>
                </DropdownMenuItem>
              </Link>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <nav className="flex items-center space-x-6">
          <a href="/about" className="text-foreground/60 hover:text-foreground transition-colors">
            About
          </a>
          <a href="/learn" className="text-foreground/60 hover:text-foreground transition-colors">
            Blog
          </a>
          {!user && (
            <Button 
              variant="ghost" 
              onClick={() => window.location.href = '/auth?login=true'}
              className="text-foreground hover:text-foreground/80 transition-colors"
            >
              Log in
            </Button>
          )}
        </nav>
      </div>
    </header>
  );
}