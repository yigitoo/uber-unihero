import { NextRequest, NextResponse } from "next/server";
import {
  getSchools,
  createSchool,
  getTotalBatches,
  getContactCount,
  getAuthEmail,
  getAllBatches,
  School,
} from "@/lib/redis";

export async function GET() {
  try {
    const schools = await getSchools();

    const stats = await Promise.all(
      schools.map(async (school) => {
        const [totalBatches, contactCount, authEmail, batches] =
          await Promise.all([
            getTotalBatches(school.id),
            getContactCount(school.id),
            getAuthEmail(school.id),
            getAllBatches(school.id),
          ]);

        const sentCount = batches.filter((b) => b.status === "sent").length;

        return {
          ...school,
          totalBatches,
          contactCount,
          authEmail,
          sentCount,
        };
      })
    );

    return NextResponse.json(stats);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch schools" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const { name, domain } = await req.json();

    if (!name || !domain) {
      return NextResponse.json(
        { error: "name and domain are required" },
        { status: 400 }
      );
    }

    // Auto-discover tenantId from domain via OpenID config
    const openIdRes = await fetch(
      `https://login.microsoftonline.com/${domain}/.well-known/openid-configuration`
    );
    if (!openIdRes.ok) {
      return NextResponse.json(
        { error: "Could not discover tenant for domain" },
        { status: 400 }
      );
    }
    const openIdData = await openIdRes.json();
    // issuer looks like: https://sts.windows.net/{tenantId}/
    const issuer: string = openIdData.issuer;
    const tenantId = issuer.split("/").filter(Boolean).pop() || "";

    if (!tenantId) {
      return NextResponse.json(
        { error: "Could not extract tenantId from issuer" },
        { status: 400 }
      );
    }

    const id = domain
      .replace(/\.[^.]+$/, "")
      .replace(/[^a-z0-9]/gi, "-")
      .toLowerCase();

    const school: School = {
      id,
      name,
      tenantId,
      domain,
      studentFilter: `@${domain}`,
      createdAt: new Date().toISOString(),
    };

    await createSchool(school);

    return NextResponse.json(school, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to create school" },
      { status: 500 }
    );
  }
}
