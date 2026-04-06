export interface ParsedGenotypeCall {
  rsid: string;
  genotype: string;
  chromosome?: string;
  position?: number;
}

export interface ParseRawSnpResult {
  calls: ParsedGenotypeCall[];
  stats: {
    rowCount: number;
    parsedCount: number;
    duplicateCount: number;
    conflictCount: number;
    missingCount: number;
    invalidRows: number;
    callRate: number;
    missingness: number;
  };
}

function normalizeGenotype(raw: string): string {
  const value = raw.trim().toUpperCase();
  if (!value || value === '--' || value === '00' || value === 'NN' || value === 'N/A') {
    return 'MISSING';
  }

  const compact = value.replace(/[^ACGT]/g, '');
  if (!compact) {
    return 'MISSING';
  }

  if (compact.length === 1) {
    return `${compact}${compact}`;
  }

  return compact.slice(0, 2);
}

function tokenizeLine(line: string): string[] {
  if (line.includes('\t')) {
    return line.split('\t').map((part) => part.trim()).filter(Boolean);
  }
  if (line.includes(',')) {
    return line.split(',').map((part) => part.trim()).filter(Boolean);
  }
  return line.split(/\s+/).map((part) => part.trim()).filter(Boolean);
}

export function parseRawSnpText(rawText: string): ParseRawSnpResult {
  const lines = rawText.split(/\r?\n/);
  const callsByRsid = new Map<string, ParsedGenotypeCall>();

  let rowCount = 0;
  let parsedCount = 0;
  let duplicateCount = 0;
  let conflictCount = 0;
  let missingCount = 0;
  let invalidRows = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const tokens = tokenizeLine(trimmed);
    if (!tokens.length) {
      continue;
    }

    if (tokens[0].toLowerCase() === 'rsid' || tokens[0].toLowerCase() === 'snp') {
      continue;
    }

    rowCount += 1;

    const rsid = tokens[0]?.trim();
    if (!rsid || !/^rs\d+$/i.test(rsid)) {
      invalidRows += 1;
      continue;
    }

    let chromosome: string | undefined;
    let position: number | undefined;
    let genotypeToken: string | undefined;

    if (tokens.length >= 4) {
      chromosome = tokens[1];
      const numericPosition = Number.parseInt(tokens[2], 10);
      position = Number.isFinite(numericPosition) ? numericPosition : undefined;
      genotypeToken = tokens[3];
    } else if (tokens.length >= 2) {
      genotypeToken = tokens[1];
    }

    if (!genotypeToken) {
      invalidRows += 1;
      continue;
    }

    const genotype = normalizeGenotype(genotypeToken);
    if (genotype === 'MISSING') {
      missingCount += 1;
    }

    const existing = callsByRsid.get(rsid);
    if (!existing) {
      callsByRsid.set(rsid, { rsid, genotype, chromosome, position });
      parsedCount += 1;
      continue;
    }

    duplicateCount += 1;
    if (existing.genotype !== genotype) {
      conflictCount += 1;
    }

    // Prefer non-missing calls when duplicates occur.
    if (existing.genotype === 'MISSING' && genotype !== 'MISSING') {
      callsByRsid.set(rsid, { rsid, genotype, chromosome, position });
    }
  }

  const callRate = parsedCount > 0 ? Number(((parsedCount - missingCount) / parsedCount).toFixed(4)) : 0;
  const missingness = parsedCount > 0 ? Number((missingCount / parsedCount).toFixed(4)) : 1;

  return {
    calls: Array.from(callsByRsid.values()),
    stats: {
      rowCount,
      parsedCount,
      duplicateCount,
      conflictCount,
      missingCount,
      invalidRows,
      callRate,
      missingness,
    },
  };
}
