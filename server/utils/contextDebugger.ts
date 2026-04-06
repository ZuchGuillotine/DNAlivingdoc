
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { Message } from '../lib/types';

interface DebugData {
  timestamp: string;
  userId: string;
  contextType: 'query' | 'qualitative';
  messageCount: number;
  systemPrompt: string | null;
  userContext: string | null;
  messages: Message[];
  tokenEstimates: {
    total: number;
    byMessage: Array<{
      role: string;
      tokens: number;
      preview: string;
    }>;
  };
  contextComponents?: {
    hasHealthStats: boolean;
    hasProfileSummary: boolean;
    hasSupplementStack: boolean;
    hasDirectSupplementInfo: boolean;
    hasPeptidesHormones: boolean;
    hasProtocols: boolean;
    hasLabResults: boolean;
    hasRecentSummaries: boolean;
    hasHistoricalSummaries: boolean;
    hasQualitativeObservations: boolean;
    hasSupplementLogs: boolean;
  };
}

export async function debugContext(
  userId: string,
  context: { messages: Message[] },
  type: 'query' | 'qualitative'
) {
  try {
    const systemMsg = context.messages.find(m => m.role === 'system');
    const userMsg = context.messages.find(m => m.role === 'user');

    const debugData: DebugData = {
      timestamp: new Date().toISOString(),
      userId,
      contextType: type,
      messageCount: context.messages.length,
      systemPrompt: systemMsg?.content || null,
      userContext: userMsg?.content || null,
      messages: context.messages,
      tokenEstimates: {
        total: context.messages.reduce((sum, msg) => sum + (msg.content?.length || 0) / 4, 0),
        byMessage: context.messages.map(msg => ({
          role: msg.role,
          tokens: (msg.content?.length || 0) / 4,
          preview: msg.content?.substring(0, 100) || ''
        }))
      },
      contextComponents: analyzeContext(context.messages)
    };

    const filename = `${type}_context_${userId}_${debugData.timestamp.replace(/:/g, '-')}.json`;
    const debugDir = join(process.cwd(), 'debug_logs');
    
    await writeFile(
      join(debugDir, filename),
      JSON.stringify(debugData, null, 2)
    );

    console.log(`Debug log created: ${filename}`);
  } catch (error) {
    console.error('Error creating debug log:', error);
  }
}

function analyzeContext(messages: Message[]) {
  const userMessage = messages.find(m => m.role === 'user')?.content || '';

  const hasNonEmpty = (marker: string) =>
    userMessage.includes(marker) && !userMessage.includes(`No ${marker.toLowerCase()} found`);

  return {
    hasHealthStats: userMessage.includes('User Context - Health Statistics:') || userMessage.includes('User Health Profile:'),
    hasProfileSummary: userMessage.includes('User Profile Summary:'),
    hasSupplementStack: userMessage.includes("User's Current Supplement Stack:"),
    hasDirectSupplementInfo: userMessage.includes('Direct Supplement Information:'),
    hasPeptidesHormones: userMessage.includes("User's Active Peptides & Hormones:"),
    hasProtocols: userMessage.includes("User's Active Protocols:"),
    hasLabResults: userMessage.includes('Lab Results:') || userMessage.includes('Lab Test Results:'),
    hasRecentSummaries: hasNonEmpty('Recent Summaries'),
    hasHistoricalSummaries: hasNonEmpty('Historical Health Summaries'),
    hasQualitativeObservations: hasNonEmpty('Qualitative Observations'),
    hasSupplementLogs: hasNonEmpty('Supplement Logs')
  };
}
