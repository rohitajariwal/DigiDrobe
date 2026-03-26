"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/layout/theme-provider";
import { Moon, Sun, Menu, X, LogOut, LayoutDashboard, Shield } from "lucide-react";
import type { Profile } from "@/lib/types";

export function Navbar() {
  const [user, setUser] = useState<Profile | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    async function getUser() {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (authUser) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", authUser.id)
          .single();
        if (profile) setUser(profile);
      }
    }
    getUser();
  }, [supabase]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    setUser(null);
    router.push("/");
    router.refresh();
  }

  return (
    <nav className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2 font-bold text-xl">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground text-sm font-bold">
            PF
          </div>
          ProjectForge AI
        </Link>

        <div className="hidden md:flex items-center gap-6">
          {user ? (
            <>
              <Link href="/dashboard" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                <span className="flex items-center gap-1"><LayoutDashboard className="h-4 w-4" /> Dashboard</span>
              </Link>
              {user.role === "admin" && (
                <Link href="/admin" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  <span className="flex items-center gap-1"><Shield className="h-4 w-4" /> Admin</span>
                </Link>
              )}
              <span className="text-sm text-muted-foreground">{user.email}</span>
              <Button variant="ghost" size="sm" onClick={handleSignOut}>
                <LogOut className="h-4 w-4" /> Sign Out
              </Button>
            </>
          ) : (
            <>
              <Link href="/login">
                <Button variant="ghost" size="sm">Sign In</Button>
              </Link>
              <Link href="/signup">
                <Button size="sm">Get Started</Button>
              </Link>
            </>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
        </div>

        <div className="flex md:hidden items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setMobileOpen(!mobileOpen)}>
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden border-t bg-background p-4 space-y-3">
          {user ? (
            <>
              <Link href="/dashboard" className="block text-sm py-2" onClick={() => setMobileOpen(false)}>Dashboard</Link>
              {user.role === "admin" && (
                <Link href="/admin" className="block text-sm py-2" onClick={() => setMobileOpen(false)}>Admin Panel</Link>
              )}
              <Button variant="ghost" size="sm" onClick={handleSignOut} className="w-full justify-start">
                <LogOut className="h-4 w-4 mr-2" /> Sign Out
              </Button>
            </>
          ) : (
            <>
              <Link href="/login" className="block" onClick={() => setMobileOpen(false)}>
                <Button variant="ghost" size="sm" className="w-full">Sign In</Button>
              </Link>
              <Link href="/signup" className="block" onClick={() => setMobileOpen(false)}>
                <Button size="sm" className="w-full">Get Started</Button>
              </Link>
            </>
          )}
        </div>
      )}
    </nav>
  );
}
