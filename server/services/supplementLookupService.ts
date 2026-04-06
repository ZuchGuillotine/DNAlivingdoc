import { db } from '../../db';
import { supplements, supplementLogs, healthStats } from '../../db/schema';
import { eq, and, desc, like, or, gte } from 'drizzle-orm';
import logger from '../utils/logger';

interface SupplementLog {
  supplementId: number | null;
  supplementName: string | null;
  dosage: string | null;
  frequency: string | null;
  takenAt: Date | null;
  notes: string | null;
  effects: {
    mood?: number;
    energy?: number;
    sleep?: number;
    sideEffects?: string[];
  } | null;
}

interface StackSupplement {
  name: string;
  dosage: string | null;
  frequency: string | null;
  notes: string | null;
}

class SupplementLookupService {
  async findSupplementLogs(
    userId: number,
    supplementName: string,
    dayLimit: number = 30
  ): Promise<SupplementLog[]> {
    try {
      logger.info(`Looking up logs for supplement "${supplementName}" for user ${userId}`);

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - dayLimit);

      const searchTerms = supplementName
        .split(' ')
        .filter((term) => term.length > 2)
        .map((term) => term.trim())
        .filter(Boolean);

      if (searchTerms.length === 0) {
        searchTerms.push(supplementName);
      }

      const searchConditions = searchTerms.map((term) => like(supplements.name, `%${term}%`));

      const logs = await db
        .select({
          supplementId: supplementLogs.supplementId,
          supplementName: supplements.name,
          dosage: supplements.dosage,
          frequency: supplements.frequency,
          takenAt: supplementLogs.takenAt,
          notes: supplementLogs.notes,
          effects: supplementLogs.effects
        })
        .from(supplementLogs)
        .leftJoin(supplements, eq(supplements.id, supplementLogs.supplementId))
        .where(
          and(
            eq(supplementLogs.userId, userId),
            gte(supplementLogs.takenAt, cutoffDate),
            or(...searchConditions)
          )
        )
        .orderBy(desc(supplementLogs.takenAt))
        .limit(10);

      logger.info(`Found ${logs.length} logs for supplement "${supplementName}"`);

      return logs;
    } catch (error) {
      logger.error('Error finding supplement logs:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        userId,
        supplementName
      });
      return [];
    }
  }

  extractSupplementNames(query: string): string[] {
    const commonSupplements = [
      'creatine',
      'vitamin d',
      'vitamin c',
      'vitamin b',
      'magnesium',
      'zinc',
      'omega-3',
      'fish oil',
      'protein',
      'pre-workout',
      'bcaa',
      'glutamine',
      'collagen',
      'probiotics',
      'melatonin'
    ];

    const queryLower = query.toLowerCase().trim();
    return commonSupplements.filter((supplement) => queryLower.includes(supplement.toLowerCase()));
  }

  async getSupplementContext(userId: number, query: string): Promise<string> {
    try {
      const supplementNames = this.extractSupplementNames(query);

      if (supplementNames.length === 0) {
        logger.info('No specific supplements identified in query');
        return '';
      }

      logger.info(`Identified supplements in query: ${supplementNames.join(', ')}`);

      let contextContent = '';

      for (const name of supplementNames) {
        const logs = await this.findSupplementLogs(userId, name);

        if (logs.length > 0) {
          contextContent += `Supplement History for ${name}:\n`;

          logs.forEach((log) => {
            const effectsText = log.effects
              ? Object.entries(log.effects)
                  .map(([key, value]) => `${key}: ${value}`)
                  .join(', ')
              : 'No effects recorded';

            const logDate = log.takenAt ? new Date(log.takenAt).toLocaleDateString() : 'Unknown Date';

            contextContent += `[${logDate}] ${log.supplementName || name}, Dosage: ${log.dosage || 'Not specified'}, Frequency: ${log.frequency || 'Not specified'}, Effects: ${effectsText}\n`;
          });

          contextContent += '\n';
        }
      }

      return contextContent;
    } catch (error) {
      logger.error('Error getting supplement context:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        userId,
        query
      });
      return '';
    }
  }

  private async getActiveSupplements(userId: number): Promise<StackSupplement[]> {
    return db
      .select({
        name: supplements.name,
        dosage: supplements.dosage,
        frequency: supplements.frequency,
        notes: supplements.notes
      })
      .from(supplements)
      .where(and(eq(supplements.userId, userId), eq(supplements.active, true)));
  }

  private isPeptideOrHormone(item: StackSupplement): boolean {
    const haystack = `${item.name} ${item.notes || ''}`.toLowerCase();
    return /(peptide|hormone|trt|testosterone|hgh|ipamorelin|cjc|bpc|tb[- ]?500|semaglutide|tirzepatide)/.test(haystack);
  }

  private isProtocol(item: StackSupplement): boolean {
    const haystack = `${item.name} ${item.notes || ''}`.toLowerCase();
    return /(protocol|sauna|cold|fast|meditation|red\s?light|zone\s?2|sleep routine|breathwork)/.test(haystack);
  }

  async getFullActiveStack(userId: number): Promise<string> {
    try {
      const activeSupplements = await this.getActiveSupplements(userId);

      if (activeSupplements.length === 0) {
        return '';
      }

      const grouped = {
        supplements: activeSupplements.filter((item) => !this.isPeptideOrHormone(item) && !this.isProtocol(item)),
        peptidesHormones: activeSupplements.filter((item) => this.isPeptideOrHormone(item)),
        protocols: activeSupplements.filter((item) => this.isProtocol(item))
      };

      let context = "User's Current Supplement Stack:\n";

      const appendGroup = (title: string, items: StackSupplement[]) => {
        if (items.length === 0) return;
        context += `  ${title}:\n`;
        items.forEach((item) => {
          let line = `    - ${item.name}`;
          if (item.dosage) line += ` (${item.dosage}`;
          if (item.frequency) line += item.dosage ? `, ${item.frequency})` : ` (${item.frequency})`;
          else if (item.dosage) line += ')';
          context += `${line}\n`;
        });
      };

      appendGroup('Supplements', grouped.supplements);
      appendGroup('Peptides/Hormones', grouped.peptidesHormones);
      appendGroup('Protocols', grouped.protocols);

      logger.info(`Built full active stack for user ${userId}: ${activeSupplements.length} items`);
      return context;
    } catch (error) {
      logger.error('Error getting full active stack:', {
        error: error instanceof Error ? error.message : String(error),
        userId
      });
      return '';
    }
  }

  async getUserPeptidesHormones(userId: number): Promise<StackSupplement[]> {
    try {
      const activeSupplements = await this.getActiveSupplements(userId);
      const results = activeSupplements.filter((item) => this.isPeptideOrHormone(item));
      logger.info(`Found ${results.length} peptides/hormones for user ${userId}`);
      return results;
    } catch (error) {
      logger.error('Error fetching peptides/hormones:', {
        error: error instanceof Error ? error.message : String(error),
        userId
      });
      return [];
    }
  }

  async getUserProtocols(userId: number): Promise<StackSupplement[]> {
    try {
      const activeSupplements = await this.getActiveSupplements(userId);
      const results = activeSupplements.filter((item) => this.isProtocol(item));
      logger.info(`Found ${results.length} protocols for user ${userId}`);
      return results;
    } catch (error) {
      logger.error('Error fetching protocols:', {
        error: error instanceof Error ? error.message : String(error),
        userId
      });
      return [];
    }
  }

  async getUserHealthProtocols(userId: number): Promise<string[]> {
    try {
      const stats = await db.query.healthStats.findFirst({
        where: eq(healthStats.userId, userId)
      });

      // health_stats currently has no protocol array in this branch schema.
      // Keep this hook so we can use it when schema is expanded.
      if (!stats) return [];
      return [];
    } catch (error) {
      logger.error('Error fetching health protocols:', {
        error: error instanceof Error ? error.message : String(error),
        userId
      });
      return [];
    }
  }

  async getPeptidesProtocolsContext(userId: number): Promise<{
    peptidesHormonesContext: string;
    protocolsContext: string;
  }> {
    try {
      const peptidesHormones = await this.getUserPeptidesHormones(userId);

      let peptidesHormonesContext = '';
      if (peptidesHormones.length > 0) {
        peptidesHormonesContext = "User's Active Peptides & Hormones:\n";
        peptidesHormones.forEach((item) => {
          let line = `- ${item.name}`;
          if (item.dosage) line += ` (${item.dosage}`;
          if (item.frequency) line += item.dosage ? `, ${item.frequency})` : ` (${item.frequency})`;
          else if (item.dosage) line += ')';
          peptidesHormonesContext += `${line}\n`;
        });
      }

      const supplementProtocols = await this.getUserProtocols(userId);
      const healthProtocols = await this.getUserHealthProtocols(userId);

      let protocolsContext = '';
      if (supplementProtocols.length > 0 || healthProtocols.length > 0) {
        protocolsContext = "User's Active Protocols:\n";

        supplementProtocols.forEach((item) => {
          let line = `- ${item.name}`;
          if (item.frequency) line += ` (${item.frequency})`;
          protocolsContext += `${line}\n`;
        });

        const existingNames = new Set(supplementProtocols.map((item) => item.name.toLowerCase()));
        healthProtocols.forEach((protocol) => {
          if (!existingNames.has(protocol.toLowerCase())) {
            protocolsContext += `- ${protocol.replace(/_/g, ' ')}\n`;
          }
        });
      }

      return {
        peptidesHormonesContext,
        protocolsContext
      };
    } catch (error) {
      logger.error('Error getting peptides/protocols context:', {
        error: error instanceof Error ? error.message : String(error),
        userId
      });
      return {
        peptidesHormonesContext: '',
        protocolsContext: ''
      };
    }
  }
}

export const supplementLookupService = new SupplementLookupService();
