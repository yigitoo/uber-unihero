import { NextResponse } from "next/server";
import { redis, getSchools } from "@/lib/redis";

export async function DELETE() {
  const schools = await getSchools();

  const pipeline = redis.pipeline();

  for (const school of schools) {
    const id = school.id;
    const totalBatches = await redis.get<number>(`batch:${id}:total`) ?? 0;

    for (let i = 1; i <= totalBatches; i++) {
      pipeline.del(`batch:${id}:${i}`);
    }
    pipeline.del(`batch:${id}:total`);
    pipeline.del(`batch:${id}:contacts`);

    pipeline.del(`mail:${id}:subject`);
    pipeline.del(`mail:${id}:body`);

    pipeline.del(`auth:${id}:access`);
    pipeline.del(`auth:${id}:refresh`);
    pipeline.del(`auth:${id}:email`);
    pipeline.del(`device:${id}`);

    pipeline.del(`settings:${id}`);
    pipeline.del(`schedule:${id}`);
    pipeline.del(`schedule:${id}:interval`);
    pipeline.del(`scrape:${id}`);
    pipeline.del(`logs:${id}`);

    const today = new Date().toISOString().slice(0, 10);
    pipeline.del(`sent:${id}:${today}`);

    pipeline.del(`school:${id}`);
    pipeline.srem("schools", id);
  }

  pipeline.del("global:settings");

  await pipeline.exec();

  return NextResponse.json({ success: true, deletedSchools: schools.length });
}
