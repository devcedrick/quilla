import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { userRole, userStatus } from "./lib/userAccess";

export default defineSchema({
  users: defineTable({
    tokenIdentifier: v.string(),
    role: userRole,
    status: userStatus,
  }).index("by_tokenIdentifier", ["tokenIdentifier"]),
});
