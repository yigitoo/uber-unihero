import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI!;

let cached = (global as Record<string, unknown>)._mongoose as {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
} | undefined;

if (!cached) {
  cached = { conn: null, promise: null };
  (global as Record<string, unknown>)._mongoose = cached;
}

export async function connectDB() {
  if (cached!.conn) return cached!.conn;
  if (!cached!.promise) {
    cached!.promise = mongoose.connect(MONGODB_URI);
  }
  cached!.conn = await cached!.promise;
  return cached!.conn;
}

// ── Schemas ──

const templateSchema = new mongoose.Schema({
  name: { type: String, required: true },
  subject: { type: String, required: true },
  body: { type: String, required: true },
}, { timestamps: true });

const contactSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  category: { type: String, enum: ["individual", "corporate"], required: true },
  company: String,
  notes: String,
  tags: [String],
}, { timestamps: true });

contactSchema.index({ email: 1 }, { unique: true });
contactSchema.index({ category: 1 });

const groupSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: String,
  color: { type: String, default: "#3b82f6" },
  members: [String],
}, { timestamps: true });

const sendLogSchema = new mongoose.Schema({
  schoolId: { type: String, required: true, index: true },
  batchId: Number,
  count: Number,
  status: { type: String, enum: ["sent", "failed"] },
  error: String,
  duration: Number,
}, { timestamps: true });

// ── Models ──

export const Template = mongoose.models.Template || mongoose.model("Template", templateSchema);
export const Contact = mongoose.models.Contact || mongoose.model("Contact", contactSchema);
export const Group = mongoose.models.Group || mongoose.model("Group", groupSchema);
export const SendLog = mongoose.models.SendLog || mongoose.model("SendLog", sendLogSchema);

// ── Types ──

export interface ITemplate {
  _id: string;
  name: string;
  subject: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}

export interface IContact {
  _id: string;
  name: string;
  email: string;
  category: "individual" | "corporate";
  company?: string;
  notes?: string;
  tags?: string[];
  createdAt: string;
}

export interface IGroup {
  _id: string;
  name: string;
  description?: string;
  color?: string;
  members: string[];
  createdAt: string;
  updatedAt: string;
}
