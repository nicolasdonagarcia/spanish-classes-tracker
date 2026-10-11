import "server-only";
import { MongoClient, type ObjectId } from "mongodb";
import { attachDatabasePool } from "@vercel/functions";
import type { RoleDef } from "@/lib/types";

/** Per-user settings: class roles with hourly rates and her retention %. */
export interface ProfileDoc {
  /** Better Auth user id */
  _id: string;
  roles: RoleDef[];
  retention: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ClassDoc {
  _id: ObjectId;
  /** Owner (Better Auth user id) */
  userId: string;
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
  roleId?: string | null;
  /** Role name snapshot */
  role?: string | null;
  /** Role rate before retention (snapshot) */
  baseRate?: number | null;
  /** Retention % applied (snapshot) */
  retention?: number | null;
  /** Effective hourly rate after retention */
  rate: number;
  amount: number;
  note?: string;
  status: "pending" | "paid";
  paidAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const uri = process.env.MONGODB_URI ?? "mongodb://127.0.0.1:27017";

const globalForMongo = globalThis as unknown as { _mongoClient?: MongoClient };

export const client =
  globalForMongo._mongoClient ??
  new MongoClient(uri, { appName: "registro-clases", maxIdleTimeMS: 5000 });

if (process.env.NODE_ENV !== "production") globalForMongo._mongoClient = client;
if (process.env.VERCEL) attachDatabasePool(client);

export const db = client.db(process.env.MONGODB_DB || "registro-clases");

export const profiles = db.collection<ProfileDoc>("profiles");
export const classes = db.collection<ClassDoc>("classes");

let ready: Promise<unknown> | null = null;

/** Creates indexes once per server instance (idempotent). */
export function ensureIndexes() {
  ready ??= Promise.all([
    classes.createIndex({ userId: 1, date: 1 }),
    // Classes saved by an earlier version used `teacherId` as the owner.
    classes.updateMany(
      { userId: { $exists: false }, teacherId: { $exists: true } } as never,
      [{ $set: { userId: "$teacherId" } }]
    ),
  ]).catch((err) => {
    ready = null;
    console.error("Could not prepare the database", err);
  });
  return ready;
}
