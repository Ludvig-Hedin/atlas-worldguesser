import type { FunctionReturnType } from "convex/server";
import { api } from "@convex/_generated/api";

/** The loaded (non-null) reactive room state returned by `rooms.getByCode`. */
export type RoomState = NonNullable<FunctionReturnType<typeof api.rooms.getByCode>>;
