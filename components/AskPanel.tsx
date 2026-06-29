"use client";

import { useState } from "react";
import { Sparkles, Loader2, Send } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiUrl } from "@/lib/api";
import type { AskResponse } from "@/types/analysis";

const MODE_LABEL: Record<AskResponse["mode"], string> = {
  structured: "exact match",
  semantic: "semantic search",
  hybrid: "hybrid",
};

const SUGGESTIONS = [
  "Which IPs broke in and when?",
  "Show me all the 401s",
  "Was there any path traversal or scanning?",
];

export function AskPanel({
  resultId,
  disabled,
  onFocusIp,
}: {
  resultId: string;
  disabled?: boolean;
  onFocusIp?: (ip: string) => void;
}) {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [resp, setResp] = useState<AskResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const ask = async (q: string) => {
    const query = q.trim();
    if (!query || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(apiUrl("/api/ask"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ result_id: resultId, question: query }),
      });
      if (!res.ok) throw new Error("not ok");
      setResp((await res.json()) as AskResponse);
    } catch {
      setError("Couldn't answer that — is the backend connected?");
      setResp(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-5 w-5 text-indigo-400" />
          Ask this analysis
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            ask(question);
          }}
          className="flex gap-2"
        >
          <Input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="e.g. which IPs broke in, or show logs from 10.0.0.5"
            disabled={disabled || loading}
          />
          <Button type="submit" disabled={disabled || loading || !question.trim()}>
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </form>

        {disabled && (
          <p className="text-xs text-muted-foreground">
            Q&amp;A is unavailable for mock data — connect the backend to ask
            questions.
          </p>
        )}

        {!resp && !error && !disabled && (
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  setQuestion(s);
                  ask(s);
                }}
                className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground hover:bg-muted"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {error && <p className="text-sm text-red-400">{error}</p>}

        {resp && (
          <div className="space-y-2 rounded-md border border-border bg-muted/30 p-3">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-[10px] uppercase">
                {MODE_LABEL[resp.mode]}
              </Badge>
            </div>
            <p className="whitespace-pre-wrap text-sm leading-relaxed">
              {resp.answer}
            </p>
            {resp.sources.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {resp.sources.map((s, i) => (
                  <button
                    key={i}
                    type="button"
                    disabled={!s.ip}
                    onClick={() => s.ip && onFocusIp?.(s.ip)}
                    title={s.text}
                    className="rounded border border-border px-2 py-0.5 text-[11px] text-muted-foreground enabled:hover:bg-muted disabled:cursor-default"
                  >
                    {s.ip ?? s.type}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
