"use client";

import { useEffect } from "react";
import { useConvexAuth, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";

/** Idempotently provisions the signed-in user in Convex once auth is ready. */
export function EnsureUser() {
  const { isAuthenticated } = useConvexAuth();
  const ensureUser = useMutation(api.users.ensureUser);

  useEffect(() => {
    if (isAuthenticated) ensureUser({}).catch(() => {});
  }, [isAuthenticated, ensureUser]);

  return null;
}
