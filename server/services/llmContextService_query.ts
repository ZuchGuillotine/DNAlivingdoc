// server/services/llmContextService_query.ts

import { Message } from '../lib/types';
import { QUERY_SYSTEM_PROMPT } from '../openai';
import { db } from '../../db';
import { logSummaries, supplementLogs, supplements, healthStats } from '../../db/schema';
import { eq, and, gte, desc } from 'drizzle-orm';
import logger from '../utils/logger';
import { debugContext } from '../utils/contextDebugger';
import { summaryTaskManager } from '../cron/summaryManager';
import { supplementLookupService } from './supplementLookupService';
import { advancedSummaryService } from './advancedSummaryService';
import { labSummaryService } from './labSummaryService';

export async function constructQueryContext(userId: number | null, userQuery: string): Promise<{ messages: Message[] }> {
  try {
    if (userId === null || userId === undefined) {
      logger.info('User not authenticated, returning basic context');
      return {
        messages: [
          { role: 'system', content: QUERY_SYSTEM_PROMPT },
          { role: 'user', content: userQuery }
        ]
      };
    }

    logger.info(`Building query context for authenticated user ${userId}`);

    try {
      await summaryTaskManager.runRealtimeSummary(userId);
      logger.info('Real-time summary triggered for query context');
    } catch (summaryError) {
      logger.warn(`Real-time summary failed for query context: ${summaryError}`);
    }

    const [healthStatsResult, directSupplementResult, peptidesProtocolsResult, fullStackResult] = await Promise.allSettled([
      db.query.healthStats.findFirst({ where: eq(healthStats.userId, userId) }),
      supplementLookupService.getSupplementContext(userId, userQuery),
      supplementLookupService.getPeptidesProtocolsContext(userId),
      supplementLookupService.getFullActiveStack(userId)
    ]);

    const userHealthStats = healthStatsResult.status === 'fulfilled' ? healthStatsResult.value : null;
    const directSupplementContext = directSupplementResult.status === 'fulfilled' ? directSupplementResult.value : '';
    const { peptidesHormonesContext = '', protocolsContext = '' } = peptidesProtocolsResult.status === 'fulfilled' ? peptidesProtocolsResult.value : {};
    const fullStackContext = fullStackResult.status === 'fulfilled' ? fullStackResult.value : '';

    [healthStatsResult, directSupplementResult, peptidesProtocolsResult, fullStackResult].forEach((result, index) => {
      if (result.status === 'rejected') {
        const names = ['healthStats', 'supplementContext', 'peptidesProtocols', 'fullStack'];
        logger.warn(`Failed to fetch ${names[index]}: ${result.reason}`);
      }
    });

    const healthStatsContext = userHealthStats
      ? `
Weight: ${userHealthStats.weight || 'Not provided'} lbs
Height: ${userHealthStats.height || 'Not provided'} inches
Gender: ${userHealthStats.gender || 'Not provided'}
Date of Birth: ${userHealthStats.dateOfBirth || 'Not provided'}
Average Sleep: ${userHealthStats.averageSleep ? `${Math.floor(userHealthStats.averageSleep / 60)}h ${userHealthStats.averageSleep % 60}m` : 'Not provided'}
Allergies: ${userHealthStats.allergies || 'None listed'}
`.replace(/\n{2,}/g, '\n')
      : 'No health stats data available.';

    let contextContent = '';

    try {
      const recentSummaries = await db
        .select()
        .from(logSummaries)
        .where(and(eq(logSummaries.userId, userId), eq(logSummaries.summaryType, 'supplement_pattern')))
        .orderBy(desc(logSummaries.createdAt))
        .limit(2);

      if (recentSummaries.length > 0) {
        contextContent += 'Recent Supplement Patterns:\n';
        recentSummaries.forEach((summary) => {
          const dateRange = `${new Date(summary.startDate).toLocaleDateString()} to ${new Date(summary.endDate).toLocaleDateString()}`;
          contextContent += `[${dateRange}]\n${summary.content}\n\n`;
        });
      }

      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

      const dailySummaries = await db
        .select()
        .from(logSummaries)
        .where(
          and(
            eq(logSummaries.userId, userId),
            eq(logSummaries.summaryType, 'daily'),
            gte(logSummaries.startDate, threeDaysAgo)
          )
        )
        .orderBy(desc(logSummaries.startDate))
        .limit(3);

      if (dailySummaries.length > 0) {
        contextContent += 'Recent Daily Summaries:\n';
        dailySummaries.forEach((summary) => {
          const date = new Date(summary.startDate).toLocaleDateString();
          contextContent += `[${date}]\n${summary.content}\n\n`;
        });
      }

      logger.info(`Retrieving relevant logs for user ${userId}`);

      let relevantContent = [];
      try {
        relevantContent = await advancedSummaryService.getRelevantSummaries(userId, userQuery, 5);

        const contentTypes = {
          summary: relevantContent.filter((item) => item.type === 'summary').length,
          qualitative_log: relevantContent.filter((item) => item.type === 'qualitative_log').length,
          quantitative_log: relevantContent.filter((item) => item.type === 'quantitative_log').length
        };

        logger.info(`Retrieved ${relevantContent.length} relevant items:`, contentTypes);
      } catch (vectorError) {
        logger.error('Vector search failed for query context, using fallback:', vectorError);
      }

      const summaries = relevantContent.filter((item) => item.type === 'summary');
      if (summaries.length > 0) {
        contextContent += 'Relevant Summary Information:\n';
        summaries.forEach((summary) => {
          const dateRange = `${new Date(summary.startDate).toLocaleDateString()} to ${new Date(summary.endDate).toLocaleDateString()}`;
          contextContent += `[${summary.summaryType.toUpperCase()} SUMMARY: ${dateRange}]\n${summary.content}\n\n`;
        });
      }

      const relevantQualitativeLogs = relevantContent.filter(
        (item) => item.type === 'qualitative_log' && item.type !== 'query'
      );
      if (relevantQualitativeLogs.length > 0) {
        contextContent += 'Relevant User Observations:\n';
        relevantQualitativeLogs.forEach((log) => {
          let content = log.content;

          try {
            const parsed = JSON.parse(log.content);
            if (Array.isArray(parsed)) {
              content = parsed
                .filter((msg) => msg.role === 'user')
                .map((msg) => msg.content)
                .join(' | ');
            }
          } catch {
            // keep raw content
          }

          contextContent += `[${new Date(log.loggedAt).toLocaleDateString()}] ${content}\n`;
        });
        contextContent += '\n';
      }

      const quantitativeLogs = relevantContent.filter((item) => item.type === 'quantitative_log');
      if (quantitativeLogs.length > 0) {
        contextContent += 'Relevant Supplement Logs:\n';
        quantitativeLogs.forEach((log) => {
          const effectsText = log.effects
            ? Object.entries(log.effects)
                .map(([key, value]) => `${key}: ${value}`)
                .join(', ')
            : 'No effects recorded';

          contextContent += `[${new Date(log.takenAt).toLocaleDateString()}] ${log.name} (${log.dosage}): ${effectsText}\n`;
        });
        contextContent += '\n';
      }

      if (contextContent === '') {
        logger.info('No relevant content found, fetching recent supplement logs as fallback');

        const recentDate = new Date();
        recentDate.setDate(recentDate.getDate() - 7);

        const recentLogs = await db
          .select({
            name: supplements.name,
            dosage: supplements.dosage,
            takenAt: supplementLogs.takenAt,
            effects: supplementLogs.effects,
            notes: supplementLogs.notes
          })
          .from(supplementLogs)
          .leftJoin(supplements, eq(supplements.id, supplementLogs.supplementId))
          .where(and(eq(supplementLogs.userId, userId), gte(supplementLogs.takenAt, recentDate)))
          .orderBy(desc(supplementLogs.takenAt))
          .limit(10);

        if (recentLogs.length > 0) {
          contextContent = 'Recent Supplement History (Last 7 Days):\n';
          recentLogs.forEach((log) => {
            const effectsText = log.effects
              ? Object.entries(log.effects)
                  .map(([key, value]) => `${key}: ${value}`)
                  .join(', ')
              : 'No effects recorded';

            contextContent += `[${new Date(log.takenAt).toLocaleDateString()}] ${log.name} (${log.dosage}): ${effectsText}\n`;
          });
        } else {
          contextContent = 'No supplement history found for this query.\n';
        }
      }
    } catch (contentError) {
      logger.error('Error building query context content:', contentError);
      contextContent = 'Error retrieving supplement history. Proceeding with limited context.\n';
    }

    let labResultsContext = '';
    try {
      const relevantLabResults = await labSummaryService.findRelevantLabResults(userId, userQuery, 2);

      if (relevantLabResults.length > 0) {
        labResultsContext = 'Recent Lab Test Results:\n';

        for (const lab of relevantLabResults) {
          const labDate = new Date(lab.uploadedAt).toLocaleDateString();

          const v2Biomarkers = lab.metadata?.biomarkers?.parsedBiomarkers;
          if (v2Biomarkers && Array.isArray(v2Biomarkers) && v2Biomarkers.length > 0) {
            const biomarkerText = v2Biomarkers
              .map((biomarker: any) => {
                let line = `${biomarker.name}: ${biomarker.value} ${biomarker.unit || ''}`;
                if (biomarker.referenceRange) line += ` (Ref: ${biomarker.referenceRange})`;
                if (biomarker.status) line += ` [${biomarker.status}]`;
                return line;
              })
              .join(', ');

            labResultsContext += `[${labDate}] ${lab.fileName}: ${biomarkerText}\n`;
            if (lab.metadata?.summary) {
              labResultsContext += `Summary: ${lab.metadata.summary}\n`;
            }
            labResultsContext += '\n';
          } else {
            labResultsContext += `[${labDate}] ${lab.fileName}: ${lab.metadata?.summary || 'No summary available'}\n\n`;
          }
        }
      }
    } catch (labError) {
      logger.warn(`Failed to fetch lab results for query context: ${labError}`);
    }

    const messages: Message[] = [
      { role: 'system', content: QUERY_SYSTEM_PROMPT },
      {
        role: 'user',
        content: `
User Health Profile:
${healthStatsContext}

${fullStackContext ? `${fullStackContext}\n` : ''}${directSupplementContext ? `Direct Supplement Information:\n${directSupplementContext}\n` : ''}
${peptidesHormonesContext ? `${peptidesHormonesContext}\n` : ''}
${protocolsContext ? `${protocolsContext}\n` : ''}
${labResultsContext ? `Lab Test Results:\n${labResultsContext}\n` : ''}
${contextContent}
User Query:
${userQuery}
`
      }
    ];

    logger.info(`Query context built successfully for user ${userId}`);

    const context = { messages };
    await debugContext(userId.toString(), context, 'query');

    return context;
  } catch (error) {
    logger.error('Error in constructQueryContext:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      userId: userId || 'anonymous',
      timestamp: new Date().toISOString()
    });

    return {
      messages: [
        { role: 'system', content: QUERY_SYSTEM_PROMPT },
        { role: 'user', content: userQuery }
      ]
    };
  }
}
