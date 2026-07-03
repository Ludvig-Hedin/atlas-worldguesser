"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { useT } from "@/hooks/use-t";
import { cn } from "@/lib/utils";

interface ChatPanelProps {
  roomId: Id<"rooms">;
  myUserId: Id<"users"> | null;
  className?: string;
}

export function ChatPanel({ roomId, myUserId, className }: ChatPanelProps) {
  const t = useT();
  const messages = useQuery(api.chat.list, { roomId });
  const send = useMutation(api.chat.send);
  const [text, setText] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages?.length]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = text.trim();
    if (!value) return;
    setText("");
    // Restore the draft on failure (e.g. rate limited) instead of losing it.
    await send({ roomId, text: value }).catch(() => {
      setText(value);
      toast.error(t("chat.notSent"));
    });
  };

  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
      <div className="flex-1 space-y-2 overflow-y-auto pr-1">
        {messages?.length === 0 && (
          <p className="py-6 text-center text-xs text-muted-foreground">{t("chat.noMessages")}</p>
        )}
        {messages?.map((m) => {
          const isMe = m.userId === myUserId;
          return (
            <div key={m._id} className="text-sm leading-snug">
              <span className={cn("font-medium", isMe ? "text-primary-muted" : "text-foreground/80")}>
                {m.username}
              </span>{" "}
              <span className="text-[10px] tabular text-subtle">
                {new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>{" "}
              <span className="text-muted-foreground">{m.text}</span>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
      <form onSubmit={submit} className="mt-2 flex items-center gap-2">
        <div className="relative flex-1">
          {text.length >= 260 && (
            <span className="pointer-events-none absolute -top-4 right-0.5 text-[10px] tabular text-muted-foreground">
              {text.length}/300
            </span>
          )}
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t("chat.placeholder")}
            maxLength={300}
            className="h-9 w-full rounded-lg border border-border bg-input px-3 text-sm outline-none placeholder:text-subtle focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <Button type="submit" size="icon-sm" variant="secondary" disabled={!text.trim()} aria-label={t("chat.sendAria")}>
          <Send className="size-3.5" />
        </Button>
      </form>
    </div>
  );
}
