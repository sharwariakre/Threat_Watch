import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8 text-center">
      <ShieldCheck className="h-14 w-14 text-primary" />
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Log Anomaly Detection</h1>
        <p className="mt-2 max-w-md text-muted-foreground">
          Upload web/proxy access logs and get a SOC-grade analysis powered by a
          deterministic parser plus Claude.
        </p>
      </div>
      <div className="flex gap-3">
        <Button asChild>
          <Link href="/upload">Get started</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/login">Sign in</Link>
        </Button>
      </div>
    </main>
  );
}
