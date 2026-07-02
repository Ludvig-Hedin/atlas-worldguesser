"use client";

import { useState } from "react";
import Link from "next/link";
import { Authenticated, Unauthenticated, useMutation, useQuery } from "convex/react";
import { SignInButton } from "@clerk/nextjs";
import { toast } from "sonner";
import { Check, UserPlus, X } from "lucide-react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { IdentityAvatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export function FriendsClient() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Friends</h1>
        <p className="mt-1 text-sm text-muted-foreground">Add players and start private matches</p>
      </div>
      <Unauthenticated>
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">Sign in to manage friends.</p>
          <SignInButton mode="modal">
            <Button>Sign in</Button>
          </SignInButton>
        </div>
      </Unauthenticated>
      <Authenticated>
        <FriendsInner />
      </Authenticated>
    </div>
  );
}

function FriendsInner() {
  const data = useQuery(api.friends.list);
  const sendRequest = useMutation(api.friends.sendRequest);
  const respond = useMutation(api.friends.respond);
  const remove = useMutation(api.friends.remove);
  const [username, setUsername] = useState("");

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = username.trim();
    if (!name) return;
    try {
      await sendRequest({ username: name });
      setUsername("");
      toast.success(`Request sent to ${name}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send request");
    }
  };

  if (data === undefined) return <Skeleton className="h-40 w-full rounded-2xl" />;

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={add} className="flex items-center gap-2">
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Add by username"
          className="h-10 flex-1 rounded-lg border border-border bg-input px-3 text-sm outline-none placeholder:text-subtle focus-visible:ring-2 focus-visible:ring-ring"
        />
        <Button type="submit" disabled={!username.trim()}>
          <UserPlus className="size-4" />
          Add
        </Button>
      </form>

      {data.incoming.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-medium text-muted-foreground">Requests</h2>
          {data.incoming.map((r) => (
            <div key={r.requestId} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
              <IdentityAvatar name={r.user.username} src={r.user.avatarUrl} />
              <span className="flex-1 truncate font-medium">{r.user.username}</span>
              <Button size="icon-sm" onClick={() => respond({ requestId: r.requestId, accept: true })} aria-label="Accept">
                <Check className="size-4" />
              </Button>
              <Button
                size="icon-sm"
                variant="secondary"
                onClick={() => respond({ requestId: r.requestId, accept: false })}
                aria-label="Decline"
              >
                <X className="size-4" />
              </Button>
            </div>
          ))}
        </section>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-muted-foreground">Your friends</h2>
        {data.friends.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card/40 p-8 text-center text-sm text-muted-foreground">
            No friends yet — add someone above.
          </div>
        ) : (
          data.friends.map((f) => (
            <div key={f._id} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
              <IdentityAvatar name={f.username} src={f.avatarUrl} />
              <Link href={`/profile/${f.username}`} className="flex-1 truncate font-medium hover:underline">
                {f.username}
              </Link>
              <Button size="sm" variant="ghost" onClick={() => remove({ friendId: f._id as Id<"users"> })}>
                Remove
              </Button>
            </div>
          ))
        )}
      </section>

      {data.outgoing.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-medium text-muted-foreground">Pending sent</h2>
          {data.outgoing.map((r) => (
            <div key={r.requestId} className="flex items-center gap-3 rounded-2xl border border-border bg-card/60 p-3">
              <IdentityAvatar name={r.user.username} src={r.user.avatarUrl} />
              <span className="flex-1 truncate text-muted-foreground">{r.user.username}</span>
              <span className="text-xs text-subtle">Pending…</span>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
