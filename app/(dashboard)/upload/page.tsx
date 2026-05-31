"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UploadCloud, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function UploadPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleAnalyze() {
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      setStatus("Uploading log file…");
      const fd = new FormData();
      fd.append("file", file);
      const upRes = await fetch("/api/upload", { method: "POST", body: fd });
      if (!upRes.ok) {
        const d = await upRes.json().catch(() => ({}));
        throw new Error(d.error ?? "Upload failed");
      }
      const { upload_id } = await upRes.json();

      setStatus("Parsing logs and running Claude analysis…");
      const anRes = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ upload_id }),
      });
      if (!anRes.ok) {
        const d = await anRes.json().catch(() => ({}));
        throw new Error(d.error ?? "Analysis failed");
      }
      const { id } = await anRes.json();
      router.push(`/results/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setStatus(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl">
      <Card>
        <CardHeader>
          <CardTitle>Upload access logs</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <label
            htmlFor="logfile"
            className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border p-10 text-center hover:border-primary/60"
          >
            <UploadCloud className="h-8 w-8 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              {file ? file.name : "Click to choose a .log / .txt file"}
            </span>
            <input
              id="logfile"
              type="file"
              accept=".log,.txt,text/plain"
              className="hidden"
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
                setError(null);
              }}
            />
          </label>

          {status && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {status}
            </p>
          )}
          {error && <p className="text-sm text-red-400">{error}</p>}

          <Button
            className="w-full"
            onClick={handleAnalyze}
            disabled={!file || busy}
          >
            {busy ? "Working…" : "Upload & Analyze"}
          </Button>

          <p className="text-center text-xs text-muted-foreground">
            Supports Apache combined, Nginx, and ZScaler formats. Try{" "}
            <code className="rounded bg-muted px-1">sample-logs/apache_sample.log</code>.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
