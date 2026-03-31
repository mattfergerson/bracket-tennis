"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { Trophy, Menu, LogOut, Settings, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function Navbar() {
  const { data: session } = useSession();

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-bold text-xl">
          <Trophy className="h-6 w-6 text-yellow-500" />
          <span>Slam Bracket</span>
        </Link>

        <div className="hidden md:flex items-center gap-6">
          <Link href="/" className="text-sm font-medium hover:text-primary transition-colors">
            Tournaments
          </Link>
          <Link href="/leaderboard" className="text-sm font-medium hover:text-primary transition-colors">
            Leaderboard
          </Link>
          {session?.user?.role === "ADMIN" && (
            <Link href="/admin" className="text-sm font-medium hover:text-primary transition-colors text-yellow-500">
              Admin
            </Link>
          )}
        </div>

        <div className="flex items-center gap-2">
          {session ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2">
                  <User className="h-4 w-4" />
                  <span className="hidden sm:inline">{session.user.name}</span>
                  <Menu className="h-4 w-4 md:hidden" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild className="md:hidden">
                  <Link href="/">Tournaments</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild className="md:hidden">
                  <Link href="/leaderboard">Leaderboard</Link>
                </DropdownMenuItem>
                {session.user.role === "ADMIN" && (
                  <>
                    <DropdownMenuSeparator className="md:hidden" />
                    <DropdownMenuItem asChild>
                      <Link href="/admin" className="text-yellow-600">
                        <Settings className="h-4 w-4 mr-2" />
                        Admin Panel
                      </Link>
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => signOut({ callbackUrl: "/" })} className="text-destructive">
                  <LogOut className="h-4 w-4 mr-2" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" asChild>
                <Link href="/auth/signin">Sign In</Link>
              </Button>
              <Button size="sm" asChild>
                <Link href="/auth/signup">Sign Up</Link>
              </Button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
