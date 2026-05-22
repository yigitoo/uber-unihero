import { NextRequest, NextResponse } from "next/server";
import {
  getSchool,
  deleteSchool,
  getTotalBatches,
  getContactCount,
  getAuthEmail,
  getAllBatches,
  getTodaySent,
} from "@/lib/redis";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const school = await getSchool(id);
    if (!school) {
      return NextResponse.json({ error: "School not found" }, { status: 404 });
    }

    const [totalBatches, contactCount, authEmail, batches, todaySent] =
      await Promise.all([
        getTotalBatches(id),
        getContactCount(id),
        getAuthEmail(id),
        getAllBatches(id),
        getTodaySent(id),
      ]);

    const sentCount = batches.filter((b) => b.status === "sent").length;
    const pendingCount = batches.filter((b) => b.status === "pending").length;
    const failedCount = batches.filter((b) => b.status === "failed").length;

    return NextResponse.json({
      ...school,
      totalBatches,
      contactCount,
      authEmail,
      sentCount,
      pendingCount,
      failedCount,
      todaySent,
      dailyLimit: 9000,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch school" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const school = await getSchool(id);
    if (!school) {
      return NextResponse.json({ error: "School not found" }, { status: 404 });
    }

    await deleteSchool(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to delete school" },
      { status: 500 }
    );
  }
}
