import React from 'react';
import { useLocation } from 'wouter';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useLabChartData } from '@/hooks/use-lab-chart-data';

const CATEGORY_COLORS = {
  lipid: 'bg-red-100 hover:bg-red-200 border-red-300',
  metabolic: 'bg-blue-100 hover:bg-blue-200 border-blue-300',
  thyroid: 'bg-green-100 hover:bg-green-200 border-green-300',
  vitamin: 'bg-yellow-100 hover:bg-yellow-200 border-yellow-300',
  blood: 'bg-purple-100 hover:bg-purple-200 border-purple-300',
  liver: 'bg-orange-100 hover:bg-orange-200 border-orange-300',
  kidney: 'bg-teal-100 hover:bg-teal-200 border-teal-300',
  hormone: 'bg-pink-100 hover:bg-pink-200 border-pink-300',
  mineral: 'bg-indigo-100 hover:bg-indigo-200 border-indigo-300',
  other: 'bg-gray-100 hover:bg-gray-200 border-gray-300'
} as const;

type CategoryType = keyof typeof CATEGORY_COLORS;

export function BiomarkerFilter() {
  const { data, isLoading, refetch, error } = useLabChartData();
  const [location, setLocation] = useLocation();
  const [urlState, setUrlState] = React.useState(location);

  // Debug logging
  React.useEffect(() => {
    console.log('🔍 BiomarkerFilter - Data State:', {
      isLoading,
      hasData: !!data,
      error: error?.message,
      allBiomarkers: data?.allBiomarkers?.length || 0,
      categories: data?.categories ? Object.keys(data.categories).length : 0,
      sampleBiomarkers: data?.allBiomarkers?.slice(0, 5),
      seriesCount: data?.series?.length || 0
    });
  }, [data, isLoading, error]);

  // Force refetch on mount to ensure we have fresh data
  React.useEffect(() => {
    console.log('BiomarkerFilter mounted, refetching data');
    refetch();
  }, [refetch]);

  // Listen for browser URL changes
  React.useEffect(() => {
    let lastUrl = window.location.pathname + window.location.search;
    
    const handleUrlChange = () => {
      const currentUrl = window.location.pathname + window.location.search;
      if (currentUrl !== lastUrl) {
        console.log('Filter: Browser URL changed to:', currentUrl);
        setUrlState(currentUrl);
        lastUrl = currentUrl;
      }
    };
    
    // Initial load
    handleUrlChange();
    
    // Listen for URL changes
    window.addEventListener('popstate', handleUrlChange);
    const interval = setInterval(handleUrlChange, 500);
    
    return () => {
      window.removeEventListener('popstate', handleUrlChange);
      clearInterval(interval);
    };
  }, []);

  const selectedNames = React.useMemo(() => {
    const params = new URLSearchParams(urlState.split('?')[1]);
    const param = params.get('biomarkers') ?? '';
    return new Set(param.split(',').filter(Boolean));
  }, [urlState]);

  const toggleName = (name: string) => {
    const next = new Set(selectedNames);
    if (next.has(name)) {
      next.delete(name);
    } else {
      next.add(name);
    }

    const params = new URLSearchParams();
    if (next.size > 0) {
      const biomarkersList = Array.from(next).join(',');
      params.set('biomarkers', biomarkersList);
    }
    
    const newSearch = params.toString();
    const basePath = location.split('?')[0];
    const newUrl = `${basePath}${newSearch ? `?${newSearch}` : ''}`;
    
    // Update URL using both methods to ensure it works
    setLocation(newUrl);
    window.history.pushState({}, '', newUrl);
  };

  if (isLoading) {
    return (
      <Card className="p-4">
        <div className="animate-pulse h-8 bg-gray-200 rounded"></div>
        <p className="text-sm text-gray-500 mt-2">Loading biomarkers...</p>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-4 border-red-200 bg-red-50">
        <div className="text-red-700">
          <p className="font-medium">Error loading biomarkers:</p>
          <p className="text-sm">{error.message}</p>
          <button 
            onClick={() => refetch()} 
            className="mt-2 px-3 py-1 bg-red-100 hover:bg-red-200 rounded text-sm"
          >
            Retry
          </button>
        </div>
      </Card>
    );
  }

  if (!data?.allBiomarkers || data.allBiomarkers.length === 0) {
    return (
      <Card className="p-4 border-yellow-200 bg-yellow-50">
        <div className="text-yellow-800">
          <p className="font-medium">No biomarkers found</p>
          <p className="text-sm">Make sure you have uploaded lab results with processed biomarker data.</p>
          {data?.series && data.series.length > 0 && (
            <p className="text-xs mt-1 text-yellow-600">
              Found {data.series.length} data series but no biomarker names extracted.
            </p>
          )}
          <button 
            onClick={() => refetch()} 
            className="mt-2 px-3 py-1 bg-yellow-100 hover:bg-yellow-200 rounded text-sm"
          >
            Refresh
          </button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <div className="mb-2">
        <p className="text-sm text-gray-600">
          Found {data.allBiomarkers.length} biomarkers
        </p>
      </div>
      <ScrollArea className="h-[200px] w-full">
        <div className="flex flex-wrap gap-2 p-2">
          {data.allBiomarkers.filter(name => name && typeof name === 'string').map((name) => {
            const category = (data.categories?.[name] as CategoryType) || 'other';
            const hasData = data.series?.some(s => s.name === name && s.points?.length > 0);
            
            return (
              <Button
                key={name}
                variant={selectedNames.has(name) ? "default" : "outline"}
                size="sm"
                onClick={() => toggleName(name)}
                disabled={!hasData}
                className={`rounded-full ${
                  selectedNames.has(name) 
                    ? '' 
                    : CATEGORY_COLORS[category]
                } ${!hasData ? 'opacity-50 cursor-not-allowed' : ''}`}
                title={hasData ? `Click to ${selectedNames.has(name) ? 'remove' : 'add'} ${name}` : `No data available for ${name}`}
              >
                {name}
                {!hasData && ' (no data)'}
              </Button>
            );
          })}
        </div>
      </ScrollArea>
    </Card>
  );
}
