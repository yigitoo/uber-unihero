import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI!;

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  role: { type: String, enum: ["admin", "user"], default: "user" },
}, { timestamps: true });

const User = mongoose.models.User || mongoose.model("User", userSchema);

async function main() {
  await mongoose.connect(MONGODB_URI);
  console.log("Connected to MongoDB");

  const users = [
    { email: "gumusyigit101@gmail.com", name: "Yiğit Gümüş", role: "admin" },
  ];

  for (const u of users) {
    const existing = await User.findOne({ email: u.email });
    if (existing) {
      console.log(`User ${u.email} already exists`);
    } else {
      await User.create(u);
      console.log(`Created user: ${u.email} (${u.role})`);
    }
  }

  await mongoose.disconnect();
  console.log("Done");
}

main().catch(console.error);
