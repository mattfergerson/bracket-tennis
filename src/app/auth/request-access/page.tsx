"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Trophy, Lock, CheckCircle } from "lucide-react";

export default function RequestAccessPage() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const formData = new FormData(e.currentTarget);

    const res = await fetch("/api/auth/request-access", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: formData.get("email"),
        name: formData.get("name"),
        message: formData.get("message"),
      }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "Something went wrong");
    } else {
      setSubmitted(true);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <Card className="w-full max-w-md">
        {submitted ? (
          <>
            <CardHeader className="text-center">
              <div className="flex justify-center mb-2">
                <CheckCircle className="h-10 w-10 text-green-500" />
              </div>
              <CardTitle className="text-2xl">Request Submitted</CardTitle>
              <CardDescription>
                Your request has been received. You&apos;ll be contacted when
                your account is ready.
              </CardDescription>
            </CardHeader>
            <CardFooter className="justify-center">
              <Button variant="ghost" asChild>
                <Link href="/">Back to home</Link>
              </Button>
            </CardFooter>
          </>
        ) : (
          <>
            <CardHeader className="text-center">
              <div className="flex justify-center mb-2">
                <Trophy className="h-10 w-10 text-yellow-500" />
              </div>
              <CardTitle className="text-2xl">Request Access</CardTitle>
              <CardDescription className="flex flex-col gap-2 pt-1">
                <span className="flex items-center justify-center gap-1.5 text-sm font-medium text-muted-foreground">
                  <Lock className="h-3.5 w-3.5" />
                  Invitation only
                </span>
                <span>
                  Slam Bracket is a private site for a select group of friends.
                  Submit your email below and the admin will review your request.
                </span>
              </CardDescription>
            </CardHeader>
            <form onSubmit={handleSubmit}>
              <CardContent className="space-y-4">
                {error && (
                  <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">
                    {error}
                  </p>
                )}
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    name="name"
                    type="text"
                    placeholder="Your name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">
                    Email <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="your@email.com"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="message">Message (optional)</Label>
                  <Textarea
                    id="message"
                    name="message"
                    placeholder="How do you know the group?"
                    rows={3}
                  />
                </div>
              </CardContent>
              <CardFooter className="flex flex-col gap-3">
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Submitting..." : "Submit Request"}
                </Button>
                <p className="text-sm text-muted-foreground text-center">
                  Already have an account?{" "}
                  <Link
                    href="/auth/signin"
                    className="text-primary hover:underline font-medium"
                  >
                    Sign in
                  </Link>
                </p>
              </CardFooter>
            </form>
          </>
        )}
      </Card>
    </div>
  );
}
