import { v, type Infer } from "convex/values";

export const userRole = v.union(v.literal("user"), v.literal("admin"));
export const userStatus = v.union(v.literal("active"), v.literal("suspended"));

export const activeAccess = v.object({
  status: v.literal("active"),
  userId: v.id("users"),
  role: userRole,
});

export const currentAccessResult = v.union(
  v.object({ status: v.literal("missing_profile") }),
  v.object({ status: v.literal("suspended") }),
  activeAccess,
);

export type ActiveAccess = Infer<typeof activeAccess>;
export type CurrentAccess = Infer<typeof currentAccessResult>;
