import "server-only";
import { MongoClient, type Collection, type ObjectId } from "mongodb";
import { attachDatabasePool } from "@vercel/functions";

import type { Role, RoleDef } from "@/lib/types";

export type { Role, RoleDef };

export interface TeamDoc {
  _id: ObjectId;
  name: string;
  ownerId: string;
  /** Class roles + hourly rates (missing on old teams → defaults). */
  roles?: RoleDef[];
  createdAt: Date;
}

export interface MemberDoc {
  _id: ObjectId;
  teamId: ObjectId;
  userId: string;
  role: Role;
  /** Teacher retention % (subtracted from the role rate). */
  retention?: number;
  createdAt: Date;
}

export interface InviteDoc {
  _id: ObjectId;
  token: string;
  teamId: ObjectId;
  createdBy: string;
  name?: string;
  createdAt: Date;
  expiresAt: Date;
  usedBy?: string;
  usedAt?: Date;
}

export interface CommentDoc {
  id: string;
  userId: string;
  name: string;
  role: Role;
  text: string;
  at: Date;
}

export interface ClassDoc {
  _id: ObjectId;
  teamId: ObjectId;
  teacherId: string;
  /** YYYY-MM-DD */
  date: string;
  /** YYYY-MM */
  month: string;
  /** HH:mm */
  start: string;
  /** HH:mm */
  end: string;
  hours: number;
  family: string;
  roleId?: string;
  /** Role name snapshot */
  role?: string;
  /** Role rate before retention (snapshot) */
  baseRate?: number;
  /** Retention % applied (snapshot) */
  retention?: number;
  /** Effective hourly rate after retention */
  rate: number;
  amount: number;
  note?: string;
  status: "pending" | "paid";
  /** Someone asked to mark it as paid; the other party must confirm. */
  request: { by: Role; userId: string; name: string; at: Date } | null;
  paidAt?: Date;
  comments: CommentDoc[];
  createdAt: Date;
  updatedAt: Date;
}

export interface UserDoc {
  _id: ObjectId;
  name: string;
  email: string;
}

const uri = process.env.MONGODB_URI ?? "mongodb://127.0.0.1:27017";

const globalForMongo = globalThis as unknown as { _mongoClient?: MongoClient };

export const client =
  globalForMongo._mongoClient ??
  new MongoClient(uri, { appName: "registro-clases", maxIdleTimeMS: 5000 });

if (process.env.NODE_ENV !== "production") globalForMongo._mongoClient = client;
if (process.env.VERCEL) attachDatabasePool(client);

export const db = client.db(process.env.MONGODB_DB || "registro-clases");

export const teams = db.collection<TeamDoc>("teams");
export const members = db.collection<MemberDoc>("members");
export const invites = db.collection<InviteDoc>("invites");
export const classes = db.collection<ClassDoc>("classes");
/** Managed by Better Auth — read-only for us. */
export const users = db.collection<UserDoc>("user") as Collection<UserDoc>;

let indexesReady: Promise<unknown> | null = null;

/** Creates indexes once per server instance (idempotent). */
export function ensureIndexes() {
  indexesReady ??= Promise.all([
    members.createIndex({ userId: 1 }, { unique: true }),
    members.createIndex({ teamId: 1 }),
    invites.createIndex({ token: 1 }, { unique: true }),
    classes.createIndex({ teamId: 1, teacherId: 1, date: 1 }),
  ]).catch((err) => {
    indexesReady = null;
    console.error("Could not create indexes", err);
  });
  return indexesReady;
}
