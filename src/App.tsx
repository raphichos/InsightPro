import React, { useState, useCallback, useMemo, useRef } from 'react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { 
  BarChart, Bar, LineChart, Line, AreaChart, Area, PieChart, Pie, 
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell 
} from 'recharts';
import { 
  Upload, 
  BarChart3, 
  LineChart as LineChartIcon, 
  PieChart as PieChartIcon, 
  Table as TableIcon, 
  Sparkles, 
  FileText, 
  X, 
  ChevronRight,
  Download,
  Filter,
  LayoutDashboard,
  BrainCircuit,
  TrendingUp,
  AlertCircle,
  Database,
  Layers,
  Activity,
  Search,
  Settings,
  Bell,
  HelpCircle,
  Plus,
  FileImage,
  File as FileIcon,
  Eye,
  AreaChart as AreaChartIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from "@google/genai";
import Markdown from 'react-markdown';
import { cn } from './lib/utils';
import { DashboardData, DataRow, ChartType } from './types';

const COLORS = ['#3b82f6', '#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

const SAMPLE_DATA: DashboardData = {
  fileName: 'quarterly_report_sample.csv',
  sourceType: 'structured',
  headers: ['Region', 'Revenue', 'Growth', 'Market Share'],
  rows: [
    { Region: 'North America', Revenue: 450000, Growth: 12, 'Market Share': 35 },
    { Region: 'Europe', Revenue: 380000, Growth: 8, 'Market Share': 28 },
    { Region: 'Asia Pacific', Revenue: 520000, Growth: 18, 'Market Share': 22 },
    { Region: 'Latin America', Revenue: 120000, Growth: 5, 'Market Share': 10 },
    { Region: 'Middle East', Revenue: 95000, Growth: 3, 'Market Share': 5 },
  ],
  numericColumns: ['Revenue', 'Growth', 'Market Share'],
  categoricalColumns: ['Region']
};

export default function App() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [selectedChart, setSelectedChart] = useState<ChartType>('bar');
  const [xAxis, setXAxis] = useState<string>('');
  const [yAxis, setYAxis] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiInsights, setAiInsights] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'data-sources' | 'analytics'>('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [showNotifications, setShowNotifications] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [notifications, setNotifications] = useState<{id: number, text: string, time: string}[]>([]);
  const dashboardRef = useRef<HTMLDivElement>(null);

  const addNotification = (text: string) => {
    setNotifications(prev => [{ id: Date.now(), text, time: 'Just now' }, ...prev].slice(0, 5));
  };

  const processStructuredData = (headers: string[], rows: DataRow[], fileName: string) => {
    const numericColumns = headers.filter(h => 
      rows.some(r => typeof r[h] === 'number')
    );
    const categoricalColumns = headers.filter(h => 
      !numericColumns.includes(h)
    );

    setData({
      headers,
      rows,
      numericColumns,
      categoricalColumns,
      sourceType: 'structured',
      fileName
    });

    if (categoricalColumns.length > 0) setXAxis(categoricalColumns[0]);
    if (numericColumns.length > 0) setYAxis(numericColumns[0]);
    setAiInsights(null);
    addNotification(`Successfully imported ${fileName}`);
    setActiveTab('overview');
  };

  const handleFileUpload = (file: File) => {
    const extension = file.name.split('.').pop()?.toLowerCase();

    if (extension === 'csv') {
      Papa.parse(file, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        complete: (results) => {
          processStructuredData(results.meta.fields || [], results.data as DataRow[], file.name);
        }
      });
    } else if (extension === 'xlsx' || extension === 'xls') {
      const reader = new FileReader();
      reader.onload = (e) => {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const json = XLSX.utils.sheet_to_json(worksheet) as DataRow[];
        if (json.length > 0) {
          processStructuredData(Object.keys(json[0]), json, file.name);
        }
      };
      reader.readAsArrayBuffer(file);
    } else if (['png', 'jpg', 'jpeg', 'pdf'].includes(extension || '')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = e.target?.result as string;
        setData({
          headers: [],
          rows: [],
          numericColumns: [],
          categoricalColumns: [],
          sourceType: 'unstructured',
          fileName: file.name,
          filePreview: base64
        });
        setAiInsights(null);
        addNotification(`Uploaded visual asset: ${file.name}`);
        setActiveTab('overview');
      };
      reader.readAsDataURL(file);
    }
  };

  const loadSampleData = () => {
    const sample = { ...SAMPLE_DATA };
    setData(sample);
    setXAxis(sample.categoricalColumns[0]);
    setYAxis(sample.numericColumns[0]);
    setAiInsights(null);
    addNotification("Loaded sample financial data");
    setActiveTab('overview');
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  }, []);

  const getAIInsights = async () => {
    if (!data) return;
    setIsAnalyzing(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      
      let contents: any;
      if (data.sourceType === 'structured') {
        contents = `Analyze this dataset and provide professional executive insights. 
        File: ${data.fileName}
        Headers: ${data.headers.join(', ')}
        Sample Data: ${JSON.stringify(data.rows.slice(0, 10))}
        
        Please provide a high-level summary, key trends, and strategic recommendations.`;
      } else {
        const [mimeType, base64Data] = data.filePreview!.split(';base64,');
        contents = {
          parts: [
            { text: "Analyze this document/image and provide professional executive insights. Summarize the key information, identify any data points or trends visible, and provide strategic recommendations." },
            { inlineData: { data: base64Data, mimeType: mimeType.split(':')[1] } }
          ]
        };
      }

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: contents,
      });

      setAiInsights(response.text || "No insights generated.");
      addNotification("AI Insights generated successfully");
    } catch (error) {
      console.error('AI Insight Error:', error);
      setAiInsights("Failed to generate insights. Please check your API key or data format.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const filteredRows = useMemo(() => {
    if (!data || data.sourceType === 'unstructured') return [];
    if (!searchQuery) return data.rows;
    const query = searchQuery.toLowerCase();
    return data.rows.filter(row => 
      Object.values(row).some(val => 
        String(val).toLowerCase().includes(query)
      )
    );
  }, [data, searchQuery]);

  const chartData = useMemo(() => {
    if (!data || data.sourceType === 'unstructured' || !xAxis || !yAxis) return [];
    const groups: { [key: string]: number } = {};
    const counts: { [key: string]: number } = {};

    // Use filteredRows so search affects charts too
    filteredRows.forEach(row => {
      const xVal = String(row[xAxis] || 'N/A');
      const yVal = Number(row[yAxis]) || 0;
      groups[xVal] = (groups[xVal] || 0) + yVal;
      counts[xVal] = (counts[xVal] || 0) + 1;
    });

    return Object.keys(groups).map(key => ({
      name: key,
      value: Number((groups[key] / (counts[key] || 1)).toFixed(2))
    })).slice(0, 15);
  }, [data, xAxis, yAxis, filteredRows]);

  const downloadPDF = async () => {
    if (!dashboardRef.current) return;
    
    setIsAnalyzing(true);
    addNotification("Preparing PDF report...");
    
    try {
      const canvas = await html2canvas(dashboardRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#020617', // Match brand-950
        onclone: (clonedDoc) => {
          // 1. Instead of removing all links, try to sanitize stylesheets by removing only problematic rules
          // This preserves the layout (flex, grid, etc.) while avoiding the oklab crash
          try {
            const styleSheets = Array.from(clonedDoc.styleSheets);
            styleSheets.forEach((sheet: any) => {
              try {
                const rules = sheet.cssRules || sheet.rules;
                if (!rules) return;
                for (let i = rules.length - 1; i >= 0; i--) {
                  const rule = rules[i];
                  if (rule.cssText && (
                    rule.cssText.includes('oklch') || 
                    rule.cssText.includes('oklab') || 
                    rule.cssText.includes('color-mix')
                  )) {
                    sheet.deleteRule(i);
                  }
                }
              } catch (e) {
                // If we can't access rules (cross-origin), we might still have issues,
                // but for Vite-served local styles it should work.
                // Fallback: if it's a local link that we can't access, we might have to remove it
                if (sheet.href && sheet.href.includes(window.location.origin)) {
                  sheet.ownerNode?.parentNode?.removeChild(sheet.ownerNode);
                }
              }
            });
          } catch (e) {
            console.warn('StyleSheet sanitization failed:', e);
          }

          // 2. Aggressively sanitize all existing style tags (inline <style>)
          const styleTags = clonedDoc.getElementsByTagName('style');
          for (let i = 0; i < styleTags.length; i++) {
            try {
              let css = styleTags[i].innerHTML;
              if (css.includes('oklch') || css.includes('oklab') || css.includes('color-mix')) {
                css = css.replace(/oklch\([^)]+\)/g, '#3b82f6');
                css = css.replace(/oklab\([^)]+\)/g, '#3b82f6');
                css = css.replace(/color-mix\([^)]+\)/g, '#3b82f6');
                styleTags[i].innerHTML = css;
              }
            } catch (e) {}
          }

          // 3. Sanitize inline styles on ALL elements
          const allElements = clonedDoc.getElementsByTagName('*');
          for (let i = 0; i < allElements.length; i++) {
            const el = allElements[i] as HTMLElement;
            if (el.style && el.getAttribute) {
              let inlineStyle = el.getAttribute('style') || '';
              if (inlineStyle.includes('oklch') || inlineStyle.includes('oklab') || inlineStyle.includes('color-mix')) {
                inlineStyle = inlineStyle.replace(/oklch\([^)]+\)/g, '#3b82f6');
                inlineStyle = inlineStyle.replace(/oklab\([^)]+\)/g, '#3b82f6');
                inlineStyle = inlineStyle.replace(/color-mix\([^)]+\)/g, '#3b82f6');
                el.setAttribute('style', inlineStyle);
              }
            }
          }

          // 4. Force dimensions and visibility for the dashboard and charts
          const clonedDashboard = (clonedDoc.querySelector('[ref="dashboardRef"]') || clonedDoc.body.children[0]) as HTMLElement;
          if (clonedDashboard && clonedDashboard.style) {
            clonedDashboard.style.width = '1200px';
            clonedDashboard.style.height = 'auto';
            clonedDashboard.style.display = 'block';
            clonedDashboard.style.visibility = 'visible';
            clonedDashboard.style.position = 'relative';
            clonedDashboard.style.padding = '40px';
            
            // Find all chart containers and give them fixed dimensions in the clone
            const chartContainers = clonedDoc.querySelectorAll('.recharts-responsive-container');
            chartContainers.forEach((container: any) => {
              if (container.style) {
                container.style.width = '800px';
                container.style.height = '450px';
                container.style.visibility = 'visible';
                container.style.display = 'block';
              }
            });
          }

          // 5. Add a style tag to the cloned document to override problematic oklab/oklch colors with hex
          const style = clonedDoc.createElement('style');
          style.innerHTML = `
            :root {
              --brand-950: #020617 !important;
              --brand-900: #0f172a !important;
              --brand-800: #1e293b !important;
              --brand-700: #334155 !important;
              --brand-600: #475569 !important;
              --brand-500: #64748b !important;
              --brand-400: #94a3b8 !important;
              --brand-300: #cbd5e1 !important;
              --brand-200: #e2e8f0 !important;
              --brand-100: #f1f5f9 !important;
              --brand-50: #f8fafc !important;
              --accent-blue: #3b82f6 !important;
              --accent-indigo: #6366f1 !important;
              --accent-emerald: #10b981 !important;
            }
            
            /* Aggressive override for all elements to avoid oklab/oklch parsing issues */
            * {
              border-color: #1e293b !important;
              outline-color: #3b82f6 !important;
              color-scheme: dark !important;
            }
            
            /* Specific overrides for Tailwind v4 color-mix and oklch defaults */
            [class*="bg-accent-blue/"], [class*="border-accent-blue/"] {
              background-color: #3b82f6 !important;
              border-color: #3b82f6 !important;
              opacity: 0.2 !important;
            }
            
            [class*="bg-accent-emerald/"], [class*="border-accent-emerald/"] {
              background-color: #10b981 !important;
              border-color: #10b981 !important;
              opacity: 0.2 !important;
            }

            [class*="bg-brand-800/"] {
              background-color: #1e293b !important;
              opacity: 0.5 !important;
            }

            [class*="bg-brand-900/"] {
              background-color: #0f172a !important;
              opacity: 0.4 !important;
            }
            
            .card-dark { 
              background-color: #0f172a !important; 
              border-color: #1e293b !important; 
            }
            .glass-dark { 
              background-color: #0f172a !important; 
              border-color: #1e293b !important; 
              opacity: 0.4 !important;
            }
            .text-brand-400 { color: #94a3b8 !important; }
            .text-brand-500 { color: #64748b !important; }
            .text-white { color: #ffffff !important; }
            .bg-brand-950 { background-color: #020617 !important; }
            .bg-brand-900 { background-color: #0f172a !important; }
            .bg-brand-800 { background-color: #1e293b !important; }
            .border-brand-800 { border-color: #1e293b !important; }
            
            /* Override any oklab/oklch gradients with standard hex gradients */
            .bg-gradient-to-r {
              background-image: linear-gradient(to right, #3b82f6, #6366f1, #10b981) !important;
            }
            
            /* Recharts specific overrides */
            .recharts-cartesian-grid-horizontal line,
            .recharts-cartesian-grid-vertical line {
              stroke: #1e293b !important;
            }
            .recharts-text {
              fill: #64748b !important;
            }
            .recharts-legend-item-text {
              color: #94a3b8 !important;
            }
            
            /* Fix for stop-color in SVG gradients which often use oklch in Tailwind v4 */
            stop {
              stop-color: #3b82f6 !important;
            }
            stop[offset="95%"] {
              stop-color: #0f172a !important;
            }
          `;
          clonedDoc.head.appendChild(style);
        }
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });
      
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      
      const widthRatio = pageWidth / (canvas.width / 2); // Divide by 2 because scale was 2
      const heightRatio = pageHeight / (canvas.height / 2);
      const ratio = Math.min(widthRatio, heightRatio) * 0.95; // 0.95 for a small margin
      
      const canvasWidth = (canvas.width / 2) * ratio;
      const canvasHeight = (canvas.height / 2) * ratio;
      
      const marginX = (pageWidth - canvasWidth) / 2;
      const marginY = (pageHeight - canvasHeight) / 2;
      
      pdf.addImage(imgData, 'PNG', marginX, marginY, canvasWidth, canvasHeight);
      
      const baseFileName = data?.fileName?.replace(/\.[^/.]+$/, "") || 'Export';
      pdf.save(`InsightPro_Report_${baseFileName}.pdf`);
      addNotification("Report downloaded successfully");
    } catch (error) {
      console.error('PDF Export Error:', error);
      addNotification("Failed to generate PDF report");
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="min-h-screen bg-brand-950 text-brand-100 flex flex-col md:flex-row font-sans">
      {/* Sidebar */}
      <aside className="w-full md:w-72 bg-brand-950 border-r border-brand-800 flex flex-col">
        <div className="p-6 flex items-center gap-3">
          <div className="w-10 h-10 bg-accent-blue rounded-xl flex items-center justify-center shadow-lg shadow-accent-blue/20">
            <TrendingUp className="w-6 h-6 text-white" />
          </div>
          <span className="text-xl font-bold tracking-tight text-white">InsightPro</span>
        </div>

        <div className="flex-1 overflow-y-auto px-4 space-y-8 custom-scrollbar">
          {/* Navigation */}
          <div className="space-y-1">
            <p className="px-3 text-[10px] font-bold text-brand-500 uppercase tracking-widest mb-2">Main Menu</p>
            <button 
              onClick={() => setActiveTab('overview')}
              className={cn("sidebar-item w-full", activeTab === 'overview' ? "sidebar-item-active" : "sidebar-item-inactive")}
            >
              <LayoutDashboard className="w-4 h-4" />
              Overview
            </button>
            <button 
              onClick={() => setActiveTab('data-sources')}
              className={cn("sidebar-item w-full", activeTab === 'data-sources' ? "sidebar-item-active" : "sidebar-item-inactive")}
            >
              <Database className="w-4 h-4" />
              Data Sources
            </button>
            <button 
              onClick={() => setActiveTab('analytics')}
              className={cn("sidebar-item w-full", activeTab === 'analytics' ? "sidebar-item-active" : "sidebar-item-inactive")}
            >
              <Activity className="w-4 h-4" />
              Analytics
            </button>
          </div>

          {/* Data Controls */}
          {data && data.sourceType === 'structured' && (
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-6"
            >
              <div className="space-y-1">
                <p className="px-3 text-[10px] font-bold text-brand-500 uppercase tracking-widest mb-2">Visualization</p>
                <div className="grid grid-cols-2 gap-2 px-1">
                  {[
                    { id: 'bar', icon: BarChart3, label: 'Bar' },
                    { id: 'line', icon: LineChartIcon, label: 'Line' },
                    { id: 'area', icon: Layers, label: 'Area' },
                    { id: 'pie', icon: PieChartIcon, label: 'Pie' }
                  ].map((type) => (
                    <button
                      key={type.id}
                      onClick={() => setSelectedChart(type.id as ChartType)}
                      className={cn(
                        "flex flex-col items-center justify-center p-3 rounded-xl border transition-all gap-2",
                        selectedChart === type.id 
                          ? "bg-brand-800 border-brand-600 text-white" 
                          : "bg-brand-900/50 border-brand-800 text-brand-400 hover:border-brand-700 hover:text-brand-200"
                      )}
                    >
                      <type.icon className="w-4 h-4" />
                      <span className="text-[10px] font-medium">{type.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-4 px-1">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-brand-500 uppercase tracking-widest px-2">Category (X)</label>
                  <select 
                    value={xAxis}
                    onChange={(e) => setXAxis(e.target.value)}
                    className="w-full bg-brand-900 border border-brand-800 rounded-lg p-2.5 text-xs text-brand-200 focus:ring-1 focus:ring-accent-blue outline-none"
                  >
                    {data.categoricalColumns.map(col => (
                      <option key={col} value={col}>{col}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-brand-500 uppercase tracking-widest px-2">Value (Y)</label>
                  <select 
                    value={yAxis}
                    onChange={(e) => setYAxis(e.target.value)}
                    className="w-full bg-brand-900 border border-brand-800 rounded-lg p-2.5 text-xs text-brand-200 focus:ring-1 focus:ring-accent-blue outline-none"
                  >
                    {data.numericColumns.map(col => (
                      <option key={col} value={col}>{col}</option>
                    ))}
                  </select>
                </div>
              </div>
            </motion.div>
          )}

          {/* Upload Area */}
          <div className="px-1">
            <div 
              className={cn(
                "border-2 border-dashed rounded-2xl p-6 text-center transition-all cursor-pointer group",
                isDragging ? "border-accent-blue bg-accent-blue/5" : "border-brand-800 hover:border-brand-600 bg-brand-900/30",
                data ? "opacity-60 hover:opacity-100" : ""
              )}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={onDrop}
              onClick={() => document.getElementById('csv-upload')?.click()}
            >
              <input 
                id="csv-upload" 
                type="file" 
                accept=".csv,.xlsx,.xls,.png,.jpg,.jpeg,.pdf" 
                className="hidden" 
                onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
              />
              <div className="flex flex-col items-center">
                <div className="w-10 h-10 bg-brand-800 rounded-full flex items-center justify-center mb-3 group-hover:bg-brand-700 transition-colors">
                  <Upload className="w-5 h-5 text-brand-300" />
                </div>
                <p className="text-xs font-semibold text-brand-200">
                  {data ? "Replace File" : "Import Media"}
                </p>
                <p className="text-[10px] text-brand-500 mt-1">CSV, XLSX, PDF, PNG</p>
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-brand-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-brand-800 border border-brand-700 flex items-center justify-center text-[10px] font-bold text-white">
              JD
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-white truncate">John Doe</p>
              <p className="text-[10px] text-brand-500 truncate">Senior Analyst</p>
            </div>
            <Settings className="w-4 h-4 text-brand-500 cursor-pointer hover:text-brand-300" />
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header */}
        <header className="h-16 border-b border-brand-800 flex items-center justify-between px-8 bg-brand-950/50 backdrop-blur-md z-10">
          <div className="flex items-center gap-4 flex-1">
            <div className="relative max-w-md w-full">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-brand-500" />
              <input 
                type="text" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search metrics or insights..." 
                className="w-full bg-brand-900/50 border border-brand-800 rounded-lg py-1.5 pl-10 pr-4 text-xs text-brand-200 focus:ring-1 focus:ring-accent-blue outline-none"
              />
            </div>
          </div>
          <div className="flex items-center gap-4 relative">
            <div className="relative">
              <button 
                onClick={() => setShowNotifications(!showNotifications)}
                className="p-2 text-brand-400 hover:text-white transition-colors relative"
              >
                <Bell className="w-5 h-5" />
                {notifications.length > 0 && (
                  <span className="absolute top-2 right-2 w-2 h-2 bg-accent-blue rounded-full border-2 border-brand-950"></span>
                )}
              </button>
              
              <AnimatePresence>
                {showNotifications && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute right-0 mt-2 w-80 card-dark rounded-xl shadow-2xl border border-brand-800 z-50 overflow-hidden"
                  >
                    <div className="p-4 border-b border-brand-800 bg-brand-900/50">
                      <p className="text-xs font-bold text-white">Notifications</p>
                    </div>
                    <div className="max-h-64 overflow-y-auto custom-scrollbar">
                      {notifications.length > 0 ? (
                        notifications.map(n => (
                          <div key={n.id} className="p-4 border-b border-brand-800 last:border-0 hover:bg-brand-900/30 transition-colors">
                            <p className="text-xs text-brand-200">{n.text}</p>
                            <p className="text-[10px] text-brand-500 mt-1">{n.time}</p>
                          </div>
                        ))
                      ) : (
                        <div className="p-8 text-center">
                          <p className="text-xs text-brand-500">No new notifications</p>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <button 
              onClick={() => setShowHelp(true)}
              className="p-2 text-brand-400 hover:text-white transition-colors"
            >
              <HelpCircle className="w-5 h-5" />
            </button>
            <div className="h-6 w-px bg-brand-800 mx-2"></div>
            <button 
              onClick={getAIInsights}
              disabled={!data || isAnalyzing}
              className="bg-accent-blue hover:bg-accent-blue/90 text-white text-xs font-bold py-2 px-4 rounded-lg flex items-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-accent-blue/20"
            >
              {isAnalyzing ? (
                <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}>
                  <Sparkles className="w-4 h-4" />
                </motion.div>
              ) : (
                <BrainCircuit className="w-4 h-4" />
              )}
              Generate Insights
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          <div ref={dashboardRef}>
            {showHelp && (
            <div className="fixed inset-0 bg-brand-950/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="max-w-lg w-full card-dark rounded-3xl p-8 relative"
              >
                <button 
                  onClick={() => setShowHelp(false)}
                  className="absolute top-6 right-6 text-brand-500 hover:text-white"
                >
                  <X className="w-6 h-6" />
                </button>
                <h3 className="text-2xl font-bold text-white mb-6">How to use InsightPro</h3>
                <div className="space-y-4 text-brand-300 text-sm">
                  <div className="flex gap-4">
                    <div className="w-8 h-8 rounded-full bg-accent-blue/20 flex items-center justify-center text-accent-blue font-bold shrink-0">1</div>
                    <p><span className="text-white font-semibold">Upload Data:</span> Drag and drop a CSV, XLSX, PDF, or Image into the sidebar upload zone.</p>
                  </div>
                  <div className="flex gap-4">
                    <div className="w-8 h-8 rounded-full bg-accent-indigo/20 flex items-center justify-center text-accent-indigo font-bold shrink-0">2</div>
                    <p><span className="text-white font-semibold">Visualize:</span> Use the sidebar controls to switch chart types and select axes for structured data.</p>
                  </div>
                  <div className="flex gap-4">
                    <div className="w-8 h-8 rounded-full bg-accent-emerald/20 flex items-center justify-center text-accent-emerald font-bold shrink-0">3</div>
                    <p><span className="text-white font-semibold">AI Analysis:</span> Click "Generate Insights" to get a multimodal AI summary of your uploaded content.</p>
                  </div>
                  <div className="flex gap-4">
                    <div className="w-8 h-8 rounded-full bg-brand-700/50 flex items-center justify-center text-brand-300 font-bold shrink-0">4</div>
                    <p><span className="text-white font-semibold">Search & Filter:</span> Use the top search bar to filter records in the Data Explorer table.</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowHelp(false)}
                  className="w-full mt-8 bg-brand-800 hover:bg-brand-700 text-white font-bold py-3 rounded-xl transition-all"
                >
                  Got it
                </button>
              </motion.div>
            </div>
          )}

          {!data ? (
            <div className="h-full flex flex-col items-center justify-center max-w-2xl mx-auto">
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="w-full card-dark rounded-[32px] p-12 text-center relative overflow-hidden"
              >
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-accent-blue via-accent-indigo to-accent-emerald"></div>
                <div className="w-24 h-24 bg-brand-800/50 rounded-3xl flex items-center justify-center mx-auto mb-8 border border-brand-700">
                  <Database className="w-12 h-12 text-accent-blue" />
                </div>
                <h2 className="text-3xl font-bold text-white mb-4">Intelligence at Scale</h2>
                <p className="text-brand-400 mb-10 leading-relaxed">
                  Connect your financial datasets, reports, or visual assets to unlock deep-learning visualizations and professional-grade executive summaries.
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                  <button 
                    onClick={() => document.getElementById('csv-upload')?.click()}
                    className="w-full sm:w-auto bg-white text-brand-950 px-8 py-3.5 rounded-xl font-bold hover:bg-brand-100 transition-all flex items-center justify-center gap-2"
                  >
                    <Plus className="w-5 h-5" />
                    Upload Media
                  </button>
                  <button 
                    onClick={loadSampleData}
                    className="w-full sm:w-auto bg-brand-800 text-white px-8 py-3.5 rounded-xl font-bold hover:bg-brand-700 transition-all border border-brand-700"
                  >
                    View Sample
                  </button>
                </div>
              </motion.div>
            </div>
          ) : (
            <div className="max-w-7xl mx-auto space-y-8">
              {activeTab === 'overview' && (
                <>
                  {/* Stats Row */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {[
                      { label: 'Source File', value: data.fileName, icon: FileIcon, color: 'text-accent-blue' },
                      { label: 'Data Type', value: data.sourceType === 'structured' ? 'Structured' : 'Unstructured', icon: Activity, color: 'text-accent-emerald' },
                      { label: 'Analysis Mode', value: data.sourceType === 'structured' ? 'Quantitative' : 'Qualitative', icon: Filter, color: 'text-accent-indigo' },
                      { label: 'System Status', value: 'Ready', icon: AlertCircle, color: 'text-brand-400' }
                    ].map((stat, i) => (
                      <motion.div 
                        key={stat.label}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className="card-dark rounded-2xl p-5 flex items-center gap-4"
                      >
                        <div className={cn("p-3 bg-brand-800/50 rounded-xl border border-brand-700", stat.color)}>
                          <stat.icon className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] font-bold text-brand-500 uppercase tracking-widest">{stat.label}</p>
                          <p className="text-sm font-bold text-white truncate">{stat.value}</p>
                        </div>
                      </motion.div>
                    ))}
                  </div>

                  {/* Main Dashboard Grid */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* Chart or Preview Section */}
                    <div id="dashboard-main-chart" className="lg:col-span-8 card-dark rounded-[32px] p-8 flex flex-col h-[600px]">
                      <div className="flex items-center justify-between mb-8">
                        <div>
                          <h3 className="text-xl font-bold text-white tracking-tight">
                            {data.sourceType === 'structured' ? 'Market Analysis' : 'Visual Asset Preview'}
                          </h3>
                          <p className="text-xs text-brand-500 mt-1">
                            {data.sourceType === 'structured' ? `Aggregated ${yAxis} by ${xAxis}` : 'Inspecting uploaded media'}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={downloadPDF}
                            className="p-2 bg-brand-800 rounded-lg text-brand-300 hover:text-white border border-brand-700 transition-all"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      
                      <div className="flex-1 min-h-[450px] w-full">
                        {data.sourceType === 'structured' ? (
                          <ResponsiveContainer width="100%" height="100%" minHeight={450}>
                            {selectedChart === 'bar' ? (
                              <BarChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10 }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10 }} />
                                <Tooltip 
                                  cursor={{ fill: '#1e293b', opacity: 0.4 }}
                                  contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', border: '1px solid #1e293b', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.5)' }}
                                  itemStyle={{ color: '#fff', fontSize: '12px' }}
                                  labelStyle={{ color: '#64748b', fontSize: '10px', marginBottom: '4px' }}
                                />
                                <Bar dataKey="value" fill="#3b82f6" radius={[6, 6, 0, 0]} barSize={40} />
                              </BarChart>
                            ) : selectedChart === 'line' ? (
                              <LineChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10 }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10 }} />
                                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', border: '1px solid #1e293b' }} />
                                <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={4} dot={{ r: 6, fill: '#3b82f6', strokeWidth: 2, stroke: '#0f172a' }} activeDot={{ r: 8 }} />
                              </LineChart>
                            ) : selectedChart === 'area' ? (
                              <AreaChart data={chartData}>
                                <defs>
                                  <linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                                  </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10 }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10 }} />
                                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', border: '1px solid #1e293b' }} />
                                <Area type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorVal)" />
                              </AreaChart>
                            ) : (
                              <PieChart>
                                <Pie
                                  data={chartData}
                                  cx="50%"
                                  cy="50%"
                                  innerRadius={80}
                                  outerRadius={120}
                                  paddingAngle={8}
                                  dataKey="value"
                                  label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                                  labelLine={false}
                                >
                                  {chartData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                  ))}
                                </Pie>
                                <Tooltip 
                                  contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', border: '1px solid #1e293b' }}
                                  formatter={(value: number, name: string, props: any) => {
                                    const total = chartData.reduce((acc, curr) => acc + curr.value, 0);
                                    const percent = ((value / total) * 100).toFixed(1);
                                    return [`${value} (${percent}%)`, 'Value'];
                                  }}
                                />
                                <Legend verticalAlign="bottom" height={36} iconType="circle" />
                              </PieChart>
                            )}
                          </ResponsiveContainer>
                        ) : (
                          <div className="h-full flex items-center justify-center bg-brand-950/50 rounded-2xl border border-brand-800 overflow-hidden">
                            {data.fileName.toLowerCase().endsWith('.pdf') ? (
                              <div className="text-center p-12">
                                <FileIcon className="w-20 h-20 text-brand-700 mx-auto mb-4" />
                                <p className="text-brand-400 font-medium">PDF Document Loaded</p>
                                <p className="text-xs text-brand-600 mt-2">AI is ready to analyze the contents of this document.</p>
                              </div>
                            ) : (
                              <img 
                                src={data.filePreview} 
                                alt="Preview" 
                                className="max-w-full max-h-full object-contain"
                                referrerPolicy="no-referrer"
                              />
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Insights Section */}
                    <div className="lg:col-span-4 card-dark rounded-[32px] p-8 flex flex-col h-[600px]">
                      <div className="flex items-center gap-3 mb-8">
                        <div className="w-10 h-10 bg-accent-indigo/10 rounded-xl flex items-center justify-center border border-accent-indigo/20">
                          <Sparkles className="w-5 h-5 text-accent-indigo" />
                        </div>
                        <h3 className="text-xl font-bold text-white tracking-tight">Strategic Insights</h3>
                      </div>
                      
                      <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                        {aiInsights ? (
                          <div className="prose prose-invert prose-sm max-w-none prose-headings:text-white prose-p:text-brand-300 prose-strong:text-accent-blue">
                            <Markdown>{aiInsights}</Markdown>
                          </div>
                        ) : isAnalyzing ? (
                          <div className="h-full flex flex-col items-center justify-center text-center space-y-6">
                            <div className="relative">
                              <motion.div
                                animate={{ scale: [1, 1.2, 1], rotate: 360 }}
                                transition={{ repeat: Infinity, duration: 3 }}
                                className="w-16 h-16 bg-accent-blue/10 rounded-full border border-accent-blue/30 flex items-center justify-center"
                              >
                                <BrainCircuit className="w-8 h-8 text-accent-blue" />
                              </motion.div>
                              <motion.div 
                                animate={{ opacity: [0, 1, 0] }}
                                transition={{ repeat: Infinity, duration: 1.5 }}
                                className="absolute -top-1 -right-1 w-4 h-4 bg-accent-emerald rounded-full border-2 border-brand-900"
                              ></motion.div>
                            </div>
                            <div>
                              <p className="text-sm font-bold text-white">Synthesizing Intelligence</p>
                              <p className="text-xs text-brand-500 mt-1">Processing complex data patterns...</p>
                            </div>
                          </div>
                        ) : (
                          <div className="h-full flex flex-col items-center justify-center text-center p-8 border border-dashed border-brand-800 rounded-2xl bg-brand-900/20">
                            <BrainCircuit className="w-10 h-10 text-brand-700 mb-4" />
                            <p className="text-sm font-medium text-brand-400">Ready for Analysis</p>
                            <p className="text-[10px] text-brand-600 mt-2 leading-relaxed">
                              Click the "Generate Insights" button to receive a deep-dive analysis of your current dataset.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Data Explorer Section (Only for structured) */}
                  {data.sourceType === 'structured' && (
                    <div className="card-dark rounded-[32px] overflow-hidden">
                      <div className="p-8 border-b border-brand-800 flex items-center justify-between bg-brand-900/30">
                        <div>
                          <h3 className="text-xl font-bold text-white tracking-tight">Data Explorer</h3>
                          <p className="text-xs text-brand-500 mt-1">Detailed record inspection</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] font-bold bg-brand-800 text-brand-300 px-3 py-1.5 rounded-full border border-brand-700">
                            {filteredRows.length} RECORDS FOUND
                          </span>
                        </div>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-brand-950/50 text-brand-500 uppercase font-bold tracking-widest">
                            <tr>
                              {data.headers.map(header => (
                                <th key={header} className="px-8 py-5 border-b border-brand-800">{header}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-brand-800">
                            {filteredRows.slice(0, 15).map((row, i) => (
                              <tr key={i} className="hover:bg-brand-800/30 transition-colors group">
                                {data.headers.map(header => (
                                  <td key={header} className="px-8 py-5 text-brand-300 group-hover:text-white transition-colors">
                                    {row[header]?.toString() || '-'}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </>
              )}

              {activeTab === 'data-sources' && (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="card-dark rounded-[32px] p-12"
                >
                  <h3 className="text-2xl font-bold text-white mb-8">Data Sources</h3>
                  <div className="space-y-6">
                    <div className="p-6 bg-brand-900/50 rounded-2xl border border-brand-800 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="p-3 bg-accent-blue/10 rounded-xl border border-accent-blue/20">
                          <FileIcon className="w-6 h-6 text-accent-blue" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-white">{data.fileName}</p>
                          <p className="text-xs text-brand-500">Active Source • {data.sourceType === 'structured' ? 'Structured Data' : 'Visual Asset'}</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => setData(null)}
                        className="text-xs font-bold text-red-400 hover:text-red-300 transition-colors"
                      >
                        Disconnect
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}

              {activeTab === 'analytics' && (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-8"
                >
                  <div className="card-dark rounded-[32px] p-12">
                    <h3 className="text-2xl font-bold text-white mb-8">Advanced Analytics</h3>
                    {aiInsights ? (
                      <div className="prose prose-invert max-w-none">
                        <Markdown>{aiInsights}</Markdown>
                      </div>
                    ) : (
                      <div className="text-center p-12 border border-dashed border-brand-800 rounded-2xl">
                        <BrainCircuit className="w-12 h-12 text-brand-700 mx-auto mb-4" />
                        <p className="text-brand-400">No analytics data generated yet.</p>
                        <button 
                          onClick={getAIInsights}
                          className="mt-6 bg-accent-blue text-white px-6 py-2 rounded-lg text-xs font-bold"
                        >
                          Run Full Analysis
                        </button>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  </div>
);
}

