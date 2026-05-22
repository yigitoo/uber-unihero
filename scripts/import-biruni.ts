import mongoose from "mongoose";
import fs from "fs";

const MONGODB_URI = process.env.MONGODB_URI!;
const INPUT_FILE = "biruni_directory.json";

const contactSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  category: { type: String, default: "individual" },
  company: String,
  source: String,
  tags: [String],
}, { timestamps: true });
contactSchema.index({ email: 1 }, { unique: true });
const Contact = mongoose.models.Contact || mongoose.model("Contact", contactSchema);

async function main() {
  const raw = JSON.parse(fs.readFileSync(INPUT_FILE, "utf-8")) as { name: string; email: string }[];
  console.log(`Loaded ${raw.length} from ${INPUT_FILE}`);

  // Filter students only
  const students = raw.filter(r => r.email.endsWith("@st.biruni.edu.tr"));
  const staff = raw.length - students.length;
  console.log(`Students: ${students.length} | Staff/other: ${staff} (skipped)`);

  await mongoose.connect(MONGODB_URI);

  const ops = students.map(r => ({
    updateOne: {
      filter: { email: r.email },
      update: {
        $setOnInsert: {
          name: r.name || r.email.split("@")[0],
          email: r.email,
          category: "individual" as const,
          company: "Biruni Üniversitesi",
          source: "google-directory",
          tags: ["biruni", "student"],
        },
      },
      upsert: true,
    },
  }));

  const result = await Contact.bulkWrite(ops, { ordered: false });
  console.log(`Upserted: ${result.upsertedCount} | Modified: ${result.modifiedCount}`);

  await mongoose.disconnect();
  console.log("Done");
}

main().catch(console.error);
