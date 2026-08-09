"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Send } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { sendMessageAction } from "@/lib/actions/messages";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type Message = { id: string; body: string | null; sender_is_admin: boolean; created_at: string };

export function MessageThread({
  orderId,
  initialMessages,
  isAdmin,
  emptyLabel = "No messages yet.",
  placeholder = "Write a message…",
  sendErrorLabel = "Message could not be sent. Please try again.",
}: {
  orderId: string;
  initialMessages: Message[];
  isAdmin: boolean;
  emptyLabel?: string;
  placeholder?: string;
  sendErrorLabel?: string;
}) {
  const [messages, setMessages] = useState(initialMessages);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState(false);
  const [pending, startTransition] = useTransition();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`order-messages-${orderId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `order_id=eq.${orderId}` },
        (payload) => {
          const incoming = payload.new as Message;
          // Our own sends are already appended optimistically in handleSend
          // (with the real row returned by sendMessageAction) — this only
          // needs to add messages from the other side, and skip duplicates
          // if the realtime event and the action response race each other.
          setMessages((prev) => (prev.some((m) => m.id === incoming.id) ? prev : [...prev, incoming]));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orderId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function handleSend() {
    if (!draft.trim()) return;
    const body = draft;
    const tempId = `pending-${Date.now()}`;
    setDraft("");
    setError(false);
    setMessages((prev) => [...prev, { id: tempId, body, sender_is_admin: isAdmin, created_at: new Date().toISOString() }]);
    startTransition(async () => {
      const result = await sendMessageAction(orderId, body);
      if (result.ok) {
        setMessages((prev) => prev.map((m) => (m.id === tempId ? result.message : m)));
      } else {
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        setError(true);
      }
    });
  }

  return (
    <div className="flex h-[420px] flex-col rounded-lg border border-border">
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 && <p className="text-sm text-muted-foreground">{emptyLabel}</p>}
        {messages.map((m) => {
          const fromSelf = m.sender_is_admin === isAdmin;
          return (
            <div key={m.id} className={cn("max-w-[80%] rounded-lg px-3.5 py-2.5 text-sm", fromSelf ? "ml-auto bg-primary text-primary-foreground" : "bg-muted text-foreground")}>
              <p className="whitespace-pre-wrap">{m.body}</p>
              <p className={cn("mt-1 text-[11px]", fromSelf ? "text-primary-foreground/70" : "text-muted-foreground")}>
                {new Date(m.created_at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
      {error && <p className="px-3 pt-2 text-xs text-destructive">{sendErrorLabel}</p>}
      <div className="flex items-end gap-2 border-t border-border p-3">
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder={placeholder}
          rows={1}
          className="min-h-10 resize-none"
        />
        <Button size="icon" disabled={pending || !draft.trim()} onClick={handleSend}>
          <Send className="size-4" />
        </Button>
      </div>
    </div>
  );
}
