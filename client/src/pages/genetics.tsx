import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Dna, FileText, Loader2 } from 'lucide-react';
import { Link } from 'wouter';
import Header from '@/components/header';
import Footer from '@/components/footer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

type ConfidenceLevel = 'high' | 'moderate' | 'low';

interface GeneticsUpload {
  id: number;
  fileName: string;
  fileType: string;
  fileUrl: string;
  ingestedAt: string;
  coverage?: {
    integrityScore: number | null;
    panelCoverage?: {
      byPanel?: Record<string, number>;
    };
  } | null;
}

interface ReportCitation {
  id: number;
  citationType: string;
  title: string;
  url: string | null;
  persistentId: string | null;
}

interface ReportFinding {
  factId: number;
  factKey: string;
  revisionId: number;
  panel: string;
  tier: number;
  sourceAuthority: string;
  rsid: string;
  genotype: string;
  claimTitle: string;
  claimSummary: string;
  claimDetails: string | null;
  reviewStatusRule: string | null;
  clinvarStarsObserved: number | null;
  confidenceModifier: string | null;
  citations: ReportCitation[];
}

interface ReportPayload {
  findings: ReportFinding[];
  deterministicHash: string;
  limitations: string[];
  coverage?: {
    byPanel?: Record<string, number>;
    byTier?: Record<string, number>;
    coveredRsids?: string[];
    missingRsids?: string[];
    callRate?: number;
    missingness?: number;
  };
  integrity?: {
    score: number | null;
    notes: string[];
  };
}

interface LatestReportSummary {
  report: {
    id: number;
    generatedAt: string;
    reportPayloadJson: ReportPayload;
  };
}

function tierLabel(tier: number): string {
  switch (tier) {
    case 1:
      return 'Tier 1 - Clinical Guideline';
    case 2:
      return 'Tier 2 - Vetted Clinical Research';
    case 3:
      return 'Tier 3 - Strong Association';
    case 4:
      return 'Tier 4 - Preliminary/Educational';
    default:
      return `Tier ${tier}`;
  }
}

function confidenceForFinding(finding: ReportFinding): ConfidenceLevel {
  if (finding.tier === 1) {
    return 'high';
  }
  if (finding.tier === 2) {
    const stars = finding.clinvarStarsObserved ?? 1;
    if (stars >= 3) return 'high';
    if (stars === 2) return 'moderate';
    return 'low';
  }
  if (finding.tier === 3) {
    return 'moderate';
  }
  return 'low';
}

function confidenceLabel(level: ConfidenceLevel): string {
  if (level === 'high') return 'High confidence';
  if (level === 'moderate') return 'Moderate confidence';
  return 'Low confidence';
}

function confidenceBadgeVariant(level: ConfidenceLevel): 'default' | 'secondary' | 'outline' {
  if (level === 'high') return 'default';
  if (level === 'moderate') return 'secondary';
  return 'outline';
}

function formatClinvarStars(stars: number | null): string | null {
  if (!stars || stars < 1) return null;
  const clamped = Math.max(1, Math.min(4, stars));
  return `${'★'.repeat(clamped)}${'☆'.repeat(4 - clamped)} (${clamped}/4)`;
}

function groupFindingsByTier(findings: ReportFinding[]): Array<{ tier: number; findings: ReportFinding[] }> {
  const grouped = new Map<number, ReportFinding[]>();
  for (const finding of findings) {
    const list = grouped.get(finding.tier) || [];
    list.push(finding);
    grouped.set(finding.tier, list);
  }

  return Array.from(grouped.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([tier, groupedFindings]) => ({
      tier,
      findings: groupedFindings.sort((left, right) => left.rsid.localeCompare(right.rsid)),
    }));
}

export default function GeneticsPage() {
  const [uploads, setUploads] = useState<GeneticsUpload[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rawText, setRawText] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [reportByUploadId, setReportByUploadId] = useState<Record<number, LatestReportSummary>>({});
  const [generatingFor, setGeneratingFor] = useState<number | null>(null);

  async function fetchUploads() {
    setLoading(true);
    try {
      const response = await fetch('/api/genetics/uploads');
      const payload = await response.json();
      if (response.ok) {
        const uploadItems = payload.uploads || [];
        setUploads(uploadItems);

        const reportEntries = await Promise.all(
          uploadItems.map(async (upload: GeneticsUpload) => {
            const reportResponse = await fetch(`/api/genetics/uploads/${upload.id}/report/latest`);
            if (!reportResponse.ok) {
              return [upload.id, null] as const;
            }
            const reportPayload = await reportResponse.json();
            return [upload.id, reportPayload as LatestReportSummary] as const;
          })
        );

        setReportByUploadId(
          reportEntries.reduce<Record<number, LatestReportSummary>>((acc, [uploadId, report]) => {
            if (report) {
              acc[uploadId] = report;
            }
            return acc;
          }, {})
        );
      } else {
        setMessage(payload.error || 'Failed to load uploads');
      }
    } catch (error) {
      console.error(error);
      setMessage('Failed to load uploads');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchUploads();
  }, []);

  async function handleUpload() {
    setSaving(true);
    setMessage(null);
    try {
      let response: Response;
      if (selectedFile) {
        const formData = new FormData();
        formData.append('file', selectedFile);
        response = await fetch('/api/genetics/uploads', {
          method: 'POST',
          body: formData,
          credentials: 'include',
        });
      } else {
        response = await fetch('/api/genetics/uploads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            rawText,
            fileName: 'manual-genetics-input.txt',
            fileType: 'text/plain',
          }),
        });
      }

      const payload = await response.json();
      if (!response.ok) {
        setMessage(payload.error || 'Upload failed');
        return;
      }

      setRawText('');
      setSelectedFile(null);
      setMessage('Upload persisted successfully.');
      await fetchUploads();
    } catch (error) {
      console.error(error);
      setMessage('Upload failed');
    } finally {
      setSaving(false);
    }
  }

  async function handleGenerateReport(uploadId: number) {
    setGeneratingFor(uploadId);
    setMessage(null);
    try {
      const response = await fetch('/api/genetics/reports/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ uploadId }),
      });
      const payload = await response.json();

      if (!response.ok) {
        setMessage(payload.error || 'Failed to generate report');
        return;
      }

      setReportByUploadId((prev) => ({
        ...prev,
        [uploadId]: {
          report: {
            id: payload.report.id,
            generatedAt: payload.report.generatedAt,
            reportPayloadJson: payload.payload,
          },
        },
      }));
      setMessage(`Generated report for upload #${uploadId}.`);
    } catch (error) {
      console.error(error);
      setMessage('Failed to generate report');
    } finally {
      setGeneratingFor(null);
    }
  }

  const canUpload = useMemo(() => {
    return Boolean(selectedFile) || rawText.trim().length > 0;
  }, [selectedFile, rawText]);

  return (
    <div className="min-h-screen flex flex-col bg-[#e8f3e8]">
      <Header />
      <main className="container mx-auto px-4 py-6 space-y-6 flex-grow">
        <div className="bg-[#1b4332] rounded-lg p-6">
          <h2 className="text-3xl font-bold text-white mb-2">Genetics (Web Preview)</h2>
          <p className="text-white/80">
            Upload raw SNP data to persist calls, compute coverage/integrity, and generate deterministic tiered reports.
          </p>
          <p className="text-green-100 text-sm mt-3">
            Migration has been executed in the collaborator test environment. Keep this feature web-only and locally validated.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Upload Raw SNP Data</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Upload File (.txt/.csv)</label>
              <Input
                type="file"
                accept=".txt,.csv,.tsv,text/plain,text/csv"
                onChange={(event) => {
                  const file = event.target.files?.[0] || null;
                  setSelectedFile(file);
                }}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Or Paste Raw SNP Text</label>
              <Textarea
                placeholder="rsid chromosome position genotype"
                value={rawText}
                onChange={(event) => setRawText(event.target.value)}
                className="min-h-[180px]"
              />
            </div>

            <Button onClick={handleUpload} disabled={!canUpload || saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Dna className="h-4 w-4 mr-2" />
                  Persist Upload
                </>
              )}
            </Button>
            {message && <p className="text-sm text-muted-foreground">{message}</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Uploads</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading uploads...
              </div>
            ) : uploads.length === 0 ? (
              <p className="text-muted-foreground">No genetics uploads yet.</p>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {uploads.map((upload) => {
                  const report = reportByUploadId[upload.id]?.report;
                  const payload = report?.reportPayloadJson;
                  const findings = payload?.findings || [];
                  const groupedFindings = groupFindingsByTier(findings);
                  const panelCoverage = payload?.coverage?.byPanel || {};
                  const tierCoverage = payload?.coverage?.byTier || {};

                  return (
                    <Card key={upload.id} className="border border-border">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          {upload.fileName}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3 text-sm">
                        <p>Uploaded: {new Date(upload.ingestedAt).toLocaleString()}</p>
                        <p>Integrity Score (upload): {upload.coverage?.integrityScore ?? 'N/A'}</p>
                        <p>
                          Panel Coverage (upload):{' '}
                          {Object.entries(upload.coverage?.panelCoverage?.byPanel || {})
                            .map(([name, pct]) => `${name}: ${pct}%`)
                            .join(' | ') || 'N/A'}
                        </p>

                        <div className="pt-1 flex items-center gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleGenerateReport(upload.id)}
                            disabled={generatingFor === upload.id}
                          >
                            {generatingFor === upload.id ? 'Generating...' : 'Generate Report'}
                          </Button>
                        </div>

                        {!report ? null : (
                          <div className="pt-2 border-t space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs text-muted-foreground">
                              <p>Report id: {report.id}</p>
                              <p>Generated: {new Date(report.generatedAt).toLocaleString()}</p>
                              <p>Hash: {payload?.deterministicHash || 'N/A'}</p>
                            </div>

                            <div className="space-y-2">
                              <h4 className="font-semibold">Coverage and Integrity</h4>
                              <p>
                                Report Integrity Score: {payload?.integrity?.score ?? 'N/A'}
                              </p>
                              <p>
                                Coverage by panel:{' '}
                                {Object.entries(panelCoverage)
                                  .map(([name, pct]) => `${name}: ${pct}%`)
                                  .join(' | ') || 'N/A'}
                              </p>
                              <p>
                                Coverage by tier:{' '}
                                {Object.entries(tierCoverage)
                                  .map(([tier, pct]) => `Tier ${tier}: ${pct}%`)
                                  .join(' | ') || 'N/A'}
                              </p>
                              {(payload?.integrity?.notes || []).length > 0 && (
                                <ul className="list-disc pl-5 text-xs text-muted-foreground">
                                  {payload.integrity.notes.map((note, index) => (
                                    <li key={`${upload.id}-integrity-${index}`}>{note}</li>
                                  ))}
                                </ul>
                              )}
                            </div>

                            <Accordion type="single" collapsible>
                              <AccordionItem value={`clinvar-stars-${upload.id}`}>
                                <AccordionTrigger className="text-sm">What do ClinVar stars mean?</AccordionTrigger>
                                <AccordionContent>
                                  <ul className="list-disc pl-5 text-xs text-muted-foreground space-y-1">
                                    <li>1 star: single submitter or limited review.</li>
                                    <li>2 stars: multiple submitters with criteria provided and no conflicts.</li>
                                    <li>3 stars: expert panel reviewed.</li>
                                    <li>4 stars: clinical practice guideline-level review.</li>
                                  </ul>
                                </AccordionContent>
                              </AccordionItem>
                            </Accordion>

                            <div className="space-y-3">
                              <h4 className="font-semibold">Findings by Tier ({findings.length})</h4>
                              {groupedFindings.length === 0 ? (
                                <p className="text-muted-foreground">No approved fact matches for this upload yet.</p>
                              ) : (
                                groupedFindings.map((tierGroup) => (
                                  <div key={`${upload.id}-tier-${tierGroup.tier}`} className="space-y-2">
                                    <p className="font-medium">{tierLabel(tierGroup.tier)}</p>
                                    <div className="space-y-2">
                                      {tierGroup.findings.map((finding) => {
                                        const confidence = confidenceForFinding(finding);
                                        const stars = formatClinvarStars(finding.clinvarStarsObserved);

                                        return (
                                          <div
                                            key={`${upload.id}-finding-${finding.revisionId}`}
                                            className="rounded-md border p-3 space-y-2"
                                          >
                                            <div className="flex flex-wrap items-center gap-2">
                                              <Badge variant={confidenceBadgeVariant(confidence)}>
                                                {confidenceLabel(confidence)}
                                              </Badge>
                                              <Badge variant="outline">{finding.panel}</Badge>
                                              <Badge variant="outline">{finding.sourceAuthority}</Badge>
                                              <span className="text-xs text-muted-foreground">
                                                {finding.rsid} / {finding.genotype}
                                              </span>
                                            </div>

                                            <p className="font-medium">{finding.claimTitle}</p>
                                            <p>{finding.claimSummary}</p>
                                            {finding.claimDetails && (
                                              <p className="text-sm text-muted-foreground">{finding.claimDetails}</p>
                                            )}

                                            {stars && (
                                              <p className="text-xs">
                                                ClinVar review stars: <span className="font-medium">{stars}</span>
                                              </p>
                                            )}
                                            {finding.reviewStatusRule && (
                                              <p className="text-xs text-muted-foreground">Rule: {finding.reviewStatusRule}</p>
                                            )}

                                            {finding.citations.length > 0 && (
                                              <div className="space-y-1">
                                                <p className="text-xs font-medium">Sources</p>
                                                <ul className="list-disc pl-5 text-xs">
                                                  {finding.citations.map((citation) => (
                                                    <li key={`${upload.id}-citation-${finding.revisionId}-${citation.id}`}>
                                                      {citation.url ? (
                                                        <a
                                                          href={citation.url}
                                                          target="_blank"
                                                          rel="noreferrer"
                                                          className="underline"
                                                        >
                                                          {citation.title}
                                                        </a>
                                                      ) : (
                                                        citation.title
                                                      )}
                                                      {citation.persistentId ? ` (${citation.persistentId})` : ''}
                                                    </li>
                                                  ))}
                                                </ul>
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                ))
                              )}
                            </div>

                            {(payload?.limitations || []).length > 0 && (
                              <div className="space-y-2">
                                <h4 className="font-semibold">Limitations</h4>
                                <ul className="list-disc pl-5 text-xs text-muted-foreground">
                                  {payload.limitations.map((limitation, index) => (
                                    <li key={`${upload.id}-limitation-${index}`}>{limitation}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Link to="/" className="flex items-center gap-2 text-black mt-6 ml-2 w-fit">
          <ArrowLeft className="h-4 w-4" /> Back to Dashboard
        </Link>
      </main>
      <Footer />
    </div>
  );
}
