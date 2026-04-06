import { db } from "@db";
import { supplementLogs, qualitativeLogs, supplements, queryChats } from "@db/schema";
import { and, sql, desc, eq, notInArray, gte } from "drizzle-orm";

export async function getQuantitativeLogs(userId: string, days: number = 30) {
  const userIdNum = parseInt(userId);
  if (isNaN(userIdNum)) {
    throw new Error('Invalid user ID');
  }

  return await db
    .select({
      supplementName: supplements.name,
      dosage: supplements.dosage,
      takenAt: supplementLogs.takenAt,
      notes: supplementLogs.notes,
      effects: supplementLogs.effects
    })
    .from(supplementLogs)
    .leftJoin(supplements, eq(supplements.id, supplementLogs.supplementId))
    .where(
      and(
        eq(supplementLogs.userId, userIdNum),
        sql`${supplementLogs.takenAt} >= NOW() - INTERVAL '30 days'`
      )
    )
    .orderBy(desc(supplementLogs.takenAt));
}

export async function getQualitativeLogs(userId: string | number, fromDate?: Date) {
  try {
    let query = db
      .select({
        content: qualitativeLogs.content,
        loggedAt: qualitativeLogs.loggedAt,
        type: qualitativeLogs.type,
        metadata: qualitativeLogs.metadata
      })
      .from(qualitativeLogs)
      .where(
        and(
          eq(qualitativeLogs.userId, typeof userId === 'string' ? parseInt(userId) : userId),
          notInArray(qualitativeLogs.type, ['query'])
        )
      )
      .orderBy(desc(qualitativeLogs.loggedAt))
      .limit(50);

    if (fromDate) {
      query = query.where(gte(qualitativeLogs.loggedAt, fromDate));
    }

    return await query;
  } catch (error) {
    console.error("Error fetching qualitative logs:", error);
    return [];
  }
}

//Added to address the request to store query chats separately
export async function getQueryChats(userId: string | number, fromDate?: Date) {
  try {
    let query = db
      .select()
      .from(queryChats)
      .where(eq(queryChats.userId, typeof userId === 'string' ? parseInt(userId) : userId))
      .orderBy(desc(queryChats.loggedAt))
      .limit(50);

    if (fromDate) {
      query = query.where(gte(queryChats.loggedAt, fromDate));
    }

    return await query;
  } catch (error) {
    console.error("Error fetching query chats:", error);
    return [];
  }
}