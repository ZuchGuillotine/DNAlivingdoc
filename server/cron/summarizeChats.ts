
import { db } from '../../db';
import { users } from '../../db/schema';
import { summarizeOldChats } from '../services/llmSummaryService';

export async function runChatSummarization() {
  const allUsers = await db.query.users.findMany();
  
  for (const user of allUsers) {
    try {
      await summarizeOldChats(user.id);
    } catch (error) {
      console.error(`Failed to summarize chats for user ${user.id}:`, error);
    }
  }
}
