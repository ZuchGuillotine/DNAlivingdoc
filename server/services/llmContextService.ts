import { SYSTEM_PROMPT } from '../openai';
import { Message } from '../lib/types';
import { db } from '../../db';
import { eq, desc, and, notInArray } from 'drizzle-orm';
import { logger } from '../utils/logger';
import { logSummaries, healthStats, qualitativeLogs } from '../../db/schema';
import { summaryTaskManager } from '../cron/summaryManager';
import { supplementLookupService } from './supplementLookupService';
import { advancedSummaryService } from './advancedSummaryService';
import { debugContext } from '../utils/contextDebugger';
import { labSummaryService } from './labSummaryService';

export async function constructUserContext(userId: string, userQuery: string): Promise<{ messages: Message[] }> {
  try {
    const userIdNum = parseInt(userId, 10);
    if (isNaN(userIdNum)) {
      throw new Error('Invalid user ID');
    }

    logger.info(`Building context for user ${userId} with query: "${userQuery.substring(0, 50)}..."`);

    try {
      await summaryTaskManager.runRealtimeSummary(userIdNum);
      logger.info('Real-time summary successfully triggered');
    } catch (error) {
      logger.warn(`Real-time summary generation failed but continuing with context building: ${error}`);
    }

    const [healthStatsResult, directSupplementResult, peptidesProtocolsResult, fullStackResult] = await Promise.allSettled([
      db.query.healthStats.findFirst({ where: eq(healthStats.userId, userIdNum) }),
      supplementLookupService.getSupplementContext(userIdNum, userQuery),
      supplementLookupService.getPeptidesProtocolsContext(userIdNum),
      supplementLookupService.getFullActiveStack(userIdNum)
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

    logger.info('Retrieving relevant content with expanded search');
    let relevantContent = [];

    try {
      relevantContent = await advancedSummaryService.getRelevantSummaries(userIdNum, userQuery, 12);

      const contentTypes = {
        summary: relevantContent.filter((item) => item.type === 'summary').length,
        qualitative_log: relevantContent.filter((item) => item.type === 'qualitative_log').length,
        quantitative_log: relevantContent.filter((item) => item.type === 'quantitative_log').length
      };

      logger.info(`Retrieved ${relevantContent.length} relevant items:`, contentTypes);
    } catch (vectorError) {
      logger.error('Vector retrieval error, falling back to recent summaries:', {
        error: vectorError instanceof Error ? vectorError.message : String(vectorError),
        stack: vectorError instanceof Error ? vectorError.stack : undefined
      });

      relevantContent = await getFallbackRelevantContent(userIdNum);
    }

    let recentSummaryContent = '';
    let historicalSummaryContent = '';
    let qualitativeLogContent = '';
    let quantitativeLogContent = '';
    let supplementLogContent = '';

    const now = new Date();
    const twoWeeksAgo = new Date(now);
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

    relevantContent
      .filter((item) => item.type === 'summary')
      .forEach((summary) => {
        const dateRange = `${new Date(summary.startDate).toLocaleDateString()} to ${new Date(summary.endDate).toLocaleDateString()}`;
        const summaryEntry = `[${summary.summaryType.toUpperCase()} SUMMARY: ${dateRange}]\n${summary.content}\n\n`;

        if (new Date(summary.endDate) >= twoWeeksAgo) {
          recentSummaryContent += summaryEntry;
        } else {
          historicalSummaryContent += summaryEntry;
        }
      });

    const relevantQualitativeLogs = relevantContent.filter(
      (item) => item.type === 'qualitative_log' && item.type !== 'query'
    );

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
        // keep raw content when not JSON
      }

      qualitativeLogContent += `[${new Date(log.loggedAt).toLocaleDateString()}] ${content}\n`;
    });

    relevantContent
      .filter((item) => item.type === 'quantitative_log')
      .forEach((log) => {
        const effectsText = log.effects
          ? Object.entries(log.effects)
              .map(([key, value]) => `${key}: ${value}`)
              .join(', ')
          : 'No effects recorded';

        quantitativeLogContent += `[${new Date(log.takenAt).toLocaleDateString()}] ${log.name} (${log.dosage}): ${effectsText}\n`;
      });

    if (relevantContent.filter((item) => item.type === 'summary').length < 2) {
      logger.info('Insufficient vector search results, fetching recent logs as fallback');

      const recentSummaries = await db
        .select()
        .from(logSummaries)
        .where(eq(logSummaries.userId, userIdNum))
        .orderBy(desc(logSummaries.createdAt))
        .limit(5);

      for (const summary of recentSummaries) {
        const dateRange = `${new Date(summary.startDate).toLocaleDateString()} to ${new Date(summary.endDate).toLocaleDateString()}`;
        supplementLogContent += `[${summary.summaryType.toUpperCase()} SUMMARY: ${dateRange}]\n${summary.content}\n\n`;
      }

      logger.info(`Added ${recentSummaries.length} recent summaries as fallback context`);
    }

    logger.info(`Context built with:
    - Recent summaries: ${recentSummaryContent ? 'Yes' : 'No'}
    - Historical summaries: ${historicalSummaryContent ? 'Yes' : 'No'}
    - Qualitative logs: ${qualitativeLogContent ? 'Yes' : 'No'}
    - Quantitative logs: ${quantitativeLogContent ? 'Yes' : 'No'}
    - Fallback summaries: ${supplementLogContent ? 'Yes' : 'No'}
    - Direct supplement context: ${directSupplementContext ? 'Yes' : 'No'}
    - Full active stack: ${fullStackContext ? 'Yes' : 'No'}
    - Peptides/Hormones context: ${peptidesHormonesContext ? 'Yes' : 'No'}
    - Protocols context: ${protocolsContext ? 'Yes' : 'No'}`);

    let labResultsContext = '';
    try {
      const relevantLabResults = await labSummaryService.findRelevantLabResults(userIdNum, userQuery, 3);

      if (relevantLabResults.length > 0) {
        labResultsContext = "User's Lab Test Results:\n";
        for (const lab of relevantLabResults) {
          const labDate = new Date(lab.uploadedAt).toLocaleDateString();

          const v2Biomarkers = lab.metadata?.biomarkers?.parsedBiomarkers;
          if (v2Biomarkers && Array.isArray(v2Biomarkers) && v2Biomarkers.length > 0) {
            logger.info(`Found v2 pipeline biomarkers for lab ${lab.id}:`, {
              biomarkerCount: v2Biomarkers.length,
              fileName: lab.fileName
            });

            const biomarkerText = v2Biomarkers
              .map((biomarker: any) => {
                let line = `${biomarker.name}: ${biomarker.value} ${biomarker.unit || ''}`;
                if (biomarker.referenceRange) line += ` (Ref: ${biomarker.referenceRange})`;
                if (biomarker.status) line += ` [${biomarker.status}]`;
                return line;
              })
              .join('\n');

            labResultsContext += `[${labDate}] ${lab.fileName}:\n${biomarkerText}\n\n`;

            if (lab.metadata?.summary) {
              labResultsContext += `Summary: ${lab.metadata.summary}\n\n`;
            }
            continue;
          }

          let extractedText = lab.metadata?.ocr?.text;
          if (!extractedText) {
            extractedText = lab.metadata?.parsedText;
          }
          if (!extractedText) {
            extractedText = lab.metadata?.preprocessedText?.normalizedText;
          }
          if (!extractedText) {
            extractedText = lab.metadata?.extractedText;
          }

          if (extractedText) {
            logger.info(`Found extracted text for lab ${lab.id}:`, {
              textLength: extractedText.length,
              source: lab.metadata?.ocr ? 'OCR' : 'PDF',
              fileName: lab.fileName
            });
            labResultsContext += `[${labDate}] ${lab.fileName}:\n${extractedText}\n\n`;
          } else if (lab.metadata?.summary) {
            logger.info(`Using summary for lab ${lab.id} - no extracted text found`);
            labResultsContext += `[${labDate}] ${lab.fileName}:\n${lab.metadata.summary}\n\n`;
          } else {
            logger.warn(`No text or summary found for lab ${lab.id}`);
            labResultsContext += `[${labDate}] ${lab.fileName}: Processing lab results...\n\n`;
          }
        }
      }
    } catch (labError) {
      logger.warn(`Failed to fetch lab results for context: ${labError}`);
    }

    const messages: Message[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: `
User Context - Health Statistics:
${healthStatsContext}

${fullStackContext ? `${fullStackContext}\n` : ''}${directSupplementContext ? `Direct Supplement Information:\n${directSupplementContext}\n` : ''}
${peptidesHormonesContext ? `${peptidesHormonesContext}\n` : ''}
${protocolsContext ? `${protocolsContext}\n` : ''}
${labResultsContext ? `User Context - Lab Results:\n${labResultsContext}\n` : ''}
User Context - Recent Summaries (last 14 days):
${recentSummaryContent || 'No recent summaries available.'}

User Context - Historical Health Summaries:
${historicalSummaryContent || 'No historical summaries available.'}

User Context - Relevant Qualitative Observations:
${qualitativeLogContent || 'No relevant qualitative observations found.'}

User Context - Relevant Supplement Logs:
${quantitativeLogContent || supplementLogContent || 'No relevant supplement logs found.'}

User Query:
${userQuery}
`
      }
    ];

    logger.info(`Context successfully built for user ${userId} with token-efficient approach`);

    const context = { messages };
    await debugContext(userId, context, 'qualitative');

    return context;
  } catch (error) {
    logger.error('Error constructing user context:', {
      userId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });

    return {
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userQuery }
      ]
    };
  }
}

async function getFallbackRelevantContent(userId: number): Promise<any[]> {
  try {
    const result = [];

    const recentSummaries = await db
      .select()
      .from(logSummaries)
      .where(and(eq(logSummaries.userId, userId), eq(logSummaries.summaryType, 'daily')))
      .orderBy(desc(logSummaries.createdAt))
      .limit(3);

    for (const summary of recentSummaries) {
      result.push({
        ...summary,
        type: 'summary',
        similarity: 0.8
      });
    }

    const recentLogs = await db
      .select()
      .from(qualitativeLogs)
      .where(and(eq(qualitativeLogs.userId, userId), notInArray(qualitativeLogs.type, ['query'])))
      .orderBy(desc(qualitativeLogs.createdAt))
      .limit(5);

    for (const log of recentLogs) {
      result.push({
        ...log,
        type: 'qualitative_log',
        similarity: 0.7
      });
    }

    logger.info(`Fallback content retrieval found ${result.length} items`);
    return result;
  } catch (error) {
    logger.error('Error in fallback content retrieval:', error);
    return [];
  }
}
