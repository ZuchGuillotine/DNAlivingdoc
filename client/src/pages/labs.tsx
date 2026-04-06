import Header from "@/components/header";
import Footer from "@/components/footer";
import LabUpload from "@/components/lab-upload";
import React, { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { File, FileText, Download, Trash2, ArrowLeft } from "lucide-react";
import { Link } from "wouter";
import { useLocation } from 'wouter';
import { BiomarkerFilter } from "@/components/BiomarkerFilter.tsx";
import { BiomarkerHistoryChart } from "@/components/BiomarkerHistoryChart";
import { useLabChartData } from "@/hooks/use-lab-chart-data";
import type { Series } from "@/types/chart";

interface LabFile {
  id: number;
  fileName: string;
  fileType: string;
  fileUrl: string;
  uploadedAt: string;
}

export default function Labs() {
  const [labFiles, setLabFiles] = useState<LabFile[]>([]);
  const { data: labChartData, isLoading: chartLoading, error: chartError } = useLabChartData();
  const [location, setLocation] = useLocation();
  const [urlState, setUrlState] = useState(location);
  
  // Listen for browser URL changes (including programmatic ones)
  useEffect(() => {
    let lastUrl = window.location.pathname + window.location.search;
    
    const handleUrlChange = () => {
      const currentUrl = window.location.pathname + window.location.search;
      if (currentUrl !== lastUrl) {
        console.log('Labs: Browser URL changed to:', currentUrl);
        setUrlState(currentUrl);
        lastUrl = currentUrl;
      }
    };
    
    // Initial load
    handleUrlChange();
    
    // Listen for popstate (back/forward) and manual updates  
    window.addEventListener('popstate', handleUrlChange);
    
    // Check URL changes less frequently and only when different
    const interval = setInterval(handleUrlChange, 500);
    
    return () => {
      window.removeEventListener('popstate', handleUrlChange);
      clearInterval(interval);
    };
  }, []);
  
  const selectedNames = useMemo(() => {
    const params = new URLSearchParams(urlState.split('?')[1]);
    const biomarkers = params.get('biomarkers') ?? '';
    const names = biomarkers.split(',').filter(Boolean);
    return new Set(names);
  }, [urlState]);
  const [isDeleting, setIsDeleting] = useState<number | null>(null);

  // Auto-select first available biomarker if none selected
  useEffect(() => {
    if (!chartLoading && labChartData?.series && labChartData.series.length > 0 && selectedNames.size === 0) {
      // Find the first biomarker that has data
      const firstBiomarkerWithData = labChartData.series.find(s => 
        s && s.points && s.points.length > 0
      );
      
      if (firstBiomarkerWithData) {
        console.log('Auto-selecting first biomarker:', firstBiomarkerWithData.name);
        const params = new URLSearchParams();
        params.set('biomarkers', firstBiomarkerWithData.name);
        const newUrl = `/labs?${params.toString()}`;
        setLocation(newUrl);
        window.history.pushState({}, '', newUrl);
      }
    }
  }, [chartLoading, labChartData, selectedNames.size, setLocation]);

  const fetchLabFiles = async () => {
    try {
      const response = await fetch('/api/labs');
      if (response.ok) {
        const data = await response.json();
        setLabFiles(data);
      }
    } catch (error) {
      console.error('Failed to fetch lab files:', error);
    }
  };

  useEffect(() => {
    fetchLabFiles();
  }, []);

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this lab result?')) {
      return;
    }

    setIsDeleting(id);
    try {
      const response = await fetch(`/api/labs/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        // Update state locally instead of re-fetching
        setLabFiles(prev => prev.filter(file => file.id !== id));
      } else {
        console.error('Failed to delete lab file');
      }
    } catch (error) {
      console.error('Error deleting lab file:', error);
    } finally {
      setIsDeleting(null);
    }
  };

  const chartData = useMemo(() => {
      if (!labChartData?.series || !Array.isArray(labChartData.series)) {
        console.log('📊 Labs: No series data available');
        return [];
      }
      
      const selectedNamesArray = Array.from(selectedNames);
      
      if (selectedNamesArray.length === 0) {
        console.log('📊 Labs: No biomarkers selected');
        return [];
      }
      
      const data = selectedNamesArray
        .map(name => {
          const series = labChartData.series.find(s => s && s.name === name);
          if (!series) {
            console.warn(`📊 Labs: Series not found for biomarker: ${name}`);
          }
          return series;
        })
        .filter((series): series is Series => {
          const isValid = series !== null && 
                 series !== undefined && 
                 typeof series === 'object' &&
                 'name' in series &&
                 'points' in series &&
                 'unit' in series &&
                 'category' in series &&
                 Array.isArray(series.points) &&
                 series.points.length > 0;
          
          if (!isValid && series) {
            console.warn('📊 Labs: Invalid series structure:', series);
          }
          return isValid;
        });
      
      console.log('📊 Labs: Chart data computed:', {
        selectedNamesSize: selectedNames.size,
        selectedNamesArray: selectedNamesArray,
        availableSeries: labChartData.series?.map(s => s?.name).filter(Boolean) || [],
        filteredData: data.map(d => `${d.name} (${d.points.length} points)`),
        validSeriesCount: data.length
      });
      
      return data;
  }, [selectedNames, labChartData?.series]);

  return (
    <div className="min-h-screen flex flex-col bg-[#e8f3e8]">
      <Header />
      <main className="container mx-auto px-4 py-6 space-y-6 flex-grow">
        <div className="bg-[#1b4332] rounded-lg p-6">
          <h2 className="text-3xl font-bold text-white mb-6">Biomarker Trends</h2>
          {labFiles.length > 0 ? (
            <>
              <BiomarkerFilter />
              <div className="mt-4">
                {chartLoading && (
                  <Card className="bg-white/10 border-none">
                    <CardContent className="p-6 text-center">
                      <p className="text-white/70">Loading chart data...</p>
                    </CardContent>
                  </Card>
                )}
                {chartError && (
                  <Card className="bg-red-50 border-red-200">
                    <CardContent className="p-6 text-center">
                      <p className="text-red-700">Error loading chart: {chartError.message}</p>
                    </CardContent>
                  </Card>
                )}
                
                {/* Always show chart area */}
                <div className="w-full max-w-[95vw] mx-auto">
                  <BiomarkerHistoryChart series={chartData} />
                </div>
              </div>
            </>
          ) : (
            <Card className="bg-white/10 border-none">
              <CardContent className="p-6 text-center">
                <FileText className="h-12 w-12 text-white/70 mx-auto mb-4" />
                <p className="text-white/90 text-lg mb-2">No lab results uploaded yet</p>
                <p className="text-white/70">Upload your first lab result to start tracking your biomarker trends</p>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="bg-[#1b4332] rounded-lg p-6">
          <h2 className="text-3xl font-bold text-white mb-6">Lab Results</h2>
          <LabUpload onUploadSuccess={fetchLabFiles} />
        </div>

        <div className="bg-[#1b4332] rounded-lg p-6">
          <h2 className="text-3xl font-bold text-white mb-6">Uploaded Files</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {labFiles.map((file) => (
              <Card key={file.id} className="bg-white/10 border-none text-white">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">{file.fileName}</CardTitle>
                  <FileText className="h-4 w-4 text-white/70" />
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-white/70">
                    Uploaded: {new Date(file.uploadedAt).toLocaleDateString()}
                  </p>
                  <div className="flex items-center gap-4 mt-2">
                    <a
                      href={file.fileUrl}
                      download
                      className="flex items-center gap-2 text-sm text-white/90 hover:text-white"
                    >
                      <Download className="h-4 w-4" />
                      Download
                    </a>
                    <button
                      onClick={() => handleDelete(file.id)}
                      disabled={isDeleting === file.id}
                      className="flex items-center gap-2 text-sm text-white/90 hover:text-white disabled:opacity-50"
                    >
                      <Trash2 className="h-4 w-4" />
                      {isDeleting === file.id ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
        <Link to="/" className="flex items-center gap-2 text-black mt-6 ml-2 w-fit">
          <ArrowLeft className="h-4 w-4" /> Back to Dashboard
        </Link>
      </main>
      <Footer />
    </div>
  );
}