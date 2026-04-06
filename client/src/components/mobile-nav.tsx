import * as React from "react"
import { Link, useLocation } from "wouter"
import { cn } from "@/lib/utils"
import {
  Home,
  PlusCircle,
  User,
  Settings,
  History,
} from "lucide-react"

export function MobileNav() {
  const [location] = useLocation()

  const navItems = [
    {
      href: "/",
      icon: Home,
      label: "Home",
    },
    {
      href: "/history",
      icon: History,
      label: "History",
    },
    {
      href: "/add",
      icon: PlusCircle,
      label: "Add",
    },
    {
      href: "/profile",
      icon: User,
      label: "Profile",
    },
    {
      href: "/settings",
      icon: Settings,
      label: "Settings",
    },
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 block border-t bg-background px-4 pb-safe md:hidden">
      <div className="mx-auto flex h-16 max-w-md items-center justify-around">
        {navItems.map((item) => (
          <Link key={item.href} href={item.href}>
            <a className="flex flex-col items-center justify-center">
              <item.icon
                className={cn(
                  "h-6 w-6",
                  location === item.href
                    ? "text-primary"
                    : "text-muted-foreground"
                )}
              />
              <span
                className={cn(
                  "text-xs",
                  location === item.href
                    ? "text-primary"
                    : "text-muted-foreground"
                )}
              >
                {item.label}
              </span>
            </a>
          </Link>
        ))}
      </div>
    </nav>
  )
}
