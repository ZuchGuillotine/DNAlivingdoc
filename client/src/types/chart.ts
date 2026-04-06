/**
 * Single data point for a biomarker measurement
 */
export interface BiomarkerDataPoint {
  /** Canonical name of the biomarker (e.g. "HDL Cholesterol") */
  name: string;
  /** Measured value */
  value: number;
  /** Unit of measurement (e.g. "mg/dL") */
  unit: string;
  /** Date of the test in ISO format */
  testDate: string;
  /** Optional biomarker category */
  category?: 'lipid' | 'metabolic' | 'thyroid' | 'vitamin' | 'mineral' | 'blood' | 'liver' | 'kidney' | 'hormone' | 'other';
  /** Optional reference range */
  referenceRange?: string;
}

/**
 * API response shape from GET /api/labs/chart-data
 */
export interface ChartApiResponse {
  /** Whether the request succeeded */
  success: boolean;
  /** Array of biomarker data points */
  data: BiomarkerDataPoint[];
  /** Pagination information */
  pagination: {
    page: number;
    pageSize: number;
    total: number;
  };
}

/**
 * Trend data point from GET /api/labs/chart-data/trends
 */
export interface TrendPoint {
  date: string;
  value: number;
}

/**
 * Series data for biomarker trends
 */
export interface TrendSeries {
  /** Name of the biomarker */
  name: string;
  /** Time-series points */
  series: TrendPoint[];
}

/**
 * API response shape from GET /api/labs/chart-data/trends
 */
export interface TrendApiResponse {
  success: boolean;
  data: TrendSeries[];
}

export interface Series {
  name: string;
  points: Array<{ testDate: string; value: number }>;
  unit: string;
  category: string;
}