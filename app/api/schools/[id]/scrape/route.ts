import { NextRequest, NextResponse } from "next/server";
import {
  getSchool,
  getScrapeState,
  setScrapeState,
  setBatch,
  setTotalBatches,
  setContactCount,
  type ScrapeState,
} from "@/lib/redis";
import { searchPeople } from "@/lib/outlook";
import { searchGoogleDirectory } from "@/lib/google";

const LETTERS = "abcçdefgğhıijklmnoöprsştuüvwxyz".split("");
const BATCH_SIZE = 100;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const state = await getScrapeState(id);
  return NextResponse.json(state ?? { status: "idle", found: 0 });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { action } = await req.json();
  const school = await getSchool(id);
  if (!school) return NextResponse.json({ error: "School not found" }, { status: 404 });

  if (action === "start") {
    const state: ScrapeState = {
      status: "running",
      found: 0,
      skippedGroups: 0,
      phase: 1,
      queries: [...LETTERS],
      currentIndex: 0,
      drillLetters: [],
      allEmails: [],
    };
    await setScrapeState(id, state);
    return NextResponse.json({ status: "running", found: 0 });
  }

  if (action === "step") {
    const state = await getScrapeState(id);
    if (!state || state.status !== "running") {
      return NextResponse.json({ done: true, found: state?.found ?? 0 });
    }

    if (state.currentIndex >= state.queries.length) {
      if (state.drillLetters.length > 0 && state.phase < 3) {
        const newQueries: string[] = [];
        for (const prefix of state.drillLetters) {
          for (const letter of LETTERS) {
            newQueries.push(prefix + letter);
          }
          newQueries.push(prefix + " ");
        }
        state.queries = newQueries;
        state.currentIndex = 0;
        state.drillLetters = [];
        state.phase++;
        await setScrapeState(id, state);
        return NextResponse.json({
          done: false,
          found: state.found,
          query: `Phase ${state.phase}`,
          progress: 0,
          total: newQueries.length,
        });
      }

      // Done — create shuffled batches
      const emails = state.allEmails.filter((e) =>
        e.endsWith(school.studentFilter)
      );

      // Shuffle
      for (let i = emails.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [emails[i], emails[j]] = [emails[j], emails[i]];
      }

      const totalBatches = Math.ceil(emails.length / BATCH_SIZE);
      for (let i = 0; i < totalBatches; i++) {
        const batch = emails.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE);
        await setBatch(id, i + 1, {
          emails: batch,
          status: "pending",
          count: batch.length,
        });
      }
      await setTotalBatches(id, totalBatches);
      await setContactCount(id, emails.length);

      state.status = "done";
      await setScrapeState(id, state);

      return NextResponse.json({
        done: true,
        found: emails.length,
        totalBatches,
      });
    }

    const query = state.queries[state.currentIndex];
    const results = school.provider === "google"
      ? await searchGoogleDirectory(id, query)
      : await searchPeople(id, query);

    const SKIP_TYPES = ["UnifiedGroup", "Group", "Room", "EquipmentMailbox"];
    let newCount = 0;
    const existingSet = new Set(state.allEmails);
    for (const r of results) {
      if (SKIP_TYPES.includes(r.type)) {
        state.skippedGroups = (state.skippedGroups || 0) + 1;
        continue;
      }
      if (!existingSet.has(r.email)) {
        state.allEmails.push(r.email);
        existingSet.add(r.email);
        newCount++;
      }
    }

    if (results.length >= 100) {
      state.drillLetters.push(query);
    }

    state.found = state.allEmails.length;
    state.currentIndex++;
    await setScrapeState(id, state);

    return NextResponse.json({
      done: false,
      found: state.found,
      query,
      resultCount: results.length,
      newCount,
      progress: Math.round((state.currentIndex / state.queries.length) * 100),
      total: state.queries.length,
    });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
