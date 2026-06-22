"use client";

import { Suspense, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Trophy } from "lucide-react";

function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/";
  const invited = searchParams.get("invited") === "1";
  const registered = searchParams.get("registered") === "true";
  const passwordReset = searchParams.get("reset") === "1";
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const result = await signIn("credentials", {
      username: formData.get("username"),
      password: formData.get("password"),
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError("Invalid username or password");
    } else {
      router.push(callbackUrl);
      router.refresh();
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <CardContent className="space-y-4">
        {(invited || registered) && (
          <p className="text-sm text-green-700 bg-green-50 border border-green-200 dark:text-green-300 dark:bg-green-900/30 dark:border-green-700 px-3 py-2 rounded-md">
            Account created! Sign in with your new credentials.
          </p>
        )}
        {passwordReset && (
          <p className="text-sm text-green-700 bg-green-50 border border-green-200 dark:text-green-300 dark:bg-green-900/30 dark:border-green-700 px-3 py-2 rounded-md">
            Password updated successfully. Sign in with your new password.
          </p>
        )}
        {error && (
          <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">
            {error}
          </p>
        )}
        <div className="space-y-2">
          <Label htmlFor="username">Username</Label>
          <Input
            id="username"
            name="username"
            type="text"
            placeholder="Enter your username"
            required
            autoComplete="username"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            placeholder="Enter your password"
            required
            autoComplete="current-password"
          />
        </div>
      </CardContent>
      <CardFooter className="flex flex-col gap-3">
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Signing in..." : "Sign In"}
        </Button>
        <div className="flex items-center justify-between w-full text-sm text-muted-foreground">
          <Link href="/auth/forgot-password" className="hover:text-foreground">
            Forgot password?
          </Link>
          <Link href="/auth/request-access" className="text-primary hover:underline font-medium">
            Request access
          </Link>
        </div>
      </CardFooter>
    </form>
  );
}

export default function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-2">
            <Trophy className="h-10 w-10 text-yellow-500" />
          </div>
          <CardTitle className="text-2xl">Welcome Back</CardTitle>
          <CardDescription>Sign in to your bracket challenge account</CardDescription>
        </CardHeader>
        <Suspense>
          <SignInForm />
        </Suspense>
      </Card>
    </div>
  );
}
