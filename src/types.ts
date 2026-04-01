export interface DataRow {
  [key: string]: any;
}

export interface DashboardData {
  headers: string[];
  rows: DataRow[];
  numericColumns: string[];
  categoricalColumns: string[];
  sourceType: 'structured' | 'unstructured';
  fileName: string;
  filePreview?: string; // Base64 for images
}

export type ChartType = 'bar' | 'line' | 'area' | 'pie';
