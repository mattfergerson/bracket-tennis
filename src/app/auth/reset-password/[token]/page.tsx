"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Trophy } from "lucide-react";
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

type TokenStatus = "loading" | "valid" | "invalid" | "expired";

export default function ResetPasswordPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();

  const [status, setStatus] = useState<TokenStatus>("loading");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function verify() {
      const res = await fetch(`/api/auth/reset-password?token=${token}`);
      if (res.ok) {
        setStatus("valid");
      } else {
        const data = await res.json().catch(() => ({}));
        setStatus(data.expired ? "expired" : "invalid");
      }
    }
    verify();
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setSubmitting(true);
    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    setSubmitting(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong. Please try again.");
      return;
    }

    router.push("/auth/signin?reset=1");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-2">
            <Trophy className="h-10 w-10 text-yellow-500" />
          </div>
          <CardTitle className="text-2xl">Reset Password</CardTitle>
          <CardDescription>
            {status === "loading"
              ? "Verifying your reset link…"
              : status === "valid"
              ? "Choose a new password"
              : "Reset link issue"}
          </CardDescription>
        </CardHeader>

        {status === "loading" && (
          <CardContent className="text-center text-muted-foreground py-8">
            Checking your reset link…
          </CardContent>
        )}

        {status === "invalid" && (
          <CardContent className="text-center space-y-4 py-6">
            <p className="text-destructive font-medium">Invalid reset link</p>
            <p className="text-sm text-muted-foreground">
              This link is not valid. Please request a new password reset.
            </p>
          </CardContent>
        )}

        {status === "expired" && (
          <CardContent className="text-center space-y-4 py-6">
            <p className="text-destructive font-medium">Reset link has expired</p>
            <p className="text-sm text-muted-foreground">
              This link expired after 1 hour. Please request a new password reset.
            </p>
          </CardContent>
        )}

        {status === "valid" && (
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              {error && (
                <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">
                  {error}
                </p>
              )}
              <div className="space-y-2">
                <Label htmlFor="password">New Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  required
                  autoComplete="new-password"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm">Confirm New Password</Label>
                <Input
                  id="confirm"
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Re-enter your new password"
                  required
                  autoComplete="new-password"
                />
              </div>
            </CardContent>
            <CardFooter>
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? "Updating…" : "Set New Password"}
              </Button>
            </CardFooter>
          </form>
        )}

        {(status === "invalid" || status === "expired") && (
          <CardFooter className="flex flex-col gap-3">
            <Link href="/auth/forgot-password" className="w-full">
              <Button className="w-full">Request New Reset Link</Button>
            </Link>
            <Link href="/auth/signin" className="w-full">
              <Button variant="outline" className="w-full">
                Back to Sign In
              </Button>
            </Link>
          </CardFooter>
        )}
      </Card>
    </div>
  );
}
