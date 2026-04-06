import { useQuery } from '@tanstack/react-query';
import { useCallback } from 'react';
import type { BiomarkerDataPoint, Series } from '@/types/chart';

interface ChartData {
  series: Series[];
  allBiomarkers: string[];
  categories: Record<string, string>;
}

interface ApiResponse {
  success: boolean;
  data: Array<{
    name: string;
    value: number;
    unit: string;
    testDate: string;
    category: string;
    status: string | null;
  }>;
  pagination: {
    page: number;
    pageSize: number;
    total: number;
  };
}

export function useLabChartData() {
  const query = useQuery<ApiResponse, Error, ChartData>({
    queryKey: ['labChartData'],
    retry: 2,
    retryDelay: 1000,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    queryFn: async () => {
      try {
        console.log('🔍 Fetching lab chart data from /api/labs/chart-data');
        
        // First request to get initial data and total count
        const firstResponse = await fetch('/api/labs/chart-data?pageSize=100&page=1', {
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json'
          }
        });

        console.log('📡 API Response:', {
          status: firstResponse.status,
          statusText: firstResponse.statusText,
          headers: Object.fromEntries(firstResponse.headers.entries())
        });

        if (!firstResponse.ok) {
          const errorText = await firstResponse.text();
          console.error('❌ API Error:', errorText);
          throw new Error(`Failed to fetch lab chart data: ${firstResponse.status} ${errorText}`);
        }

        const firstData = await firstResponse.json();
        console.log('📊 Initial API Data:', {
          success: firstData.success,
          dataLength: firstData.data?.length || 0,
          pagination: firstData.pagination,
          totalPages: firstData.pagination?.totalPages || 1
        });

        // If there's only one page, return the data
        if (!firstData.pagination || firstData.pagination.totalPages <= 1) {
          return firstData;
        }

        // Otherwise, fetch remaining pages
        const allData = [...firstData.data];
        const totalPages = firstData.pagination.totalPages;
        
        console.log(`📄 Fetching ${totalPages - 1} additional pages...`);
        
        // Fetch remaining pages in parallel for better performance
        const pagePromises = [];
        for (let page = 2; page <= totalPages; page++) {
          pagePromises.push(
            fetch(`/api/labs/chart-data?pageSize=100&page=${page}`, {
              credentials: 'include',
              headers: {
                'Content-Type': 'application/json'
              }
            }).then(res => res.json())
          );
        }

        const additionalPages = await Promise.all(pagePromises);
        
        // Combine all data
        for (const pageData of additionalPages) {
          if (pageData.success && pageData.data) {
            allData.push(...pageData.data);
          }
        }

        console.log(`✅ Fetched total of ${allData.length} biomarker records across ${totalPages} pages`);

        // Return combined response
        return {
          ...firstData,
          data: allData,
          pagination: {
            ...firstData.pagination,
            page: 1,
            pageSize: allData.length,
            total: allData.length
          }
        };
      } catch (error) {
        console.error('🚨 Fetch Error:', error);
        throw error;
      }
    },
    select: (response) => {
      console.log('🔄 Processing API response:', response);
      
      const biomarkers = new Map<string, Array<{
        value: number;
        testDate: string;
        unit: string;
      }>>();

      const categoriesMap: Record<string, string> = {};
      let filteredCount = 0;

      if (!response.success || !response.data || !Array.isArray(response.data)) {
        console.warn('⚠️ Invalid API response structure:', {
          success: response.success,
          hasData: !!response.data,
          isArray: Array.isArray(response.data)
        });
        return {
          series: [],
          allBiomarkers: [],
          categories: {}
        };
      }

      const allBiomarkers = Array.from(new Set(response.data.map(biomarker => biomarker.name)));
      console.log('📋 Found biomarkers:', allBiomarkers);

      response.data.forEach(biomarker => {
        // Validate required fields
        if (!biomarker.name || biomarker.value == null || isNaN(Number(biomarker.value)) || !biomarker.testDate) {
          filteredCount++;
          console.warn('🚫 Filtered invalid biomarker:', biomarker);
          return;
        }
        
        const series = biomarkers.get(biomarker.name) || [];
        series.push({
          value: Number(biomarker.value),
          testDate: biomarker.testDate,
          unit: biomarker.unit || ''
        });
        biomarkers.set(biomarker.name, series);

        if (biomarker.category) {
          categoriesMap[biomarker.name] = biomarker.category;
        }
      });

      const allSeries = Array.from(biomarkers.entries()).map(([name, points]) => ({
        name,
        points: points.sort((a, b) => 
          new Date(a.testDate).getTime() - new Date(b.testDate).getTime()
        ),
        unit: points[0]?.unit || '',
        category: categoriesMap[name] || 'other'
      }));

      console.log('✅ Processed data:', {
        filteredCount,
        seriesCount: allSeries.length,
        biomarkersWithData: allSeries.map(s => `${s.name} (${s.points.length} points)`),
        categories: categoriesMap
      });

      return {
        series: allSeries,
        allBiomarkers: allBiomarkers,
        categories: categoriesMap
      };
    },
  });

  const getSeriesByName = useCallback((name: string): Series | undefined => {
    return query.data?.series.find(s => s.name === name);
  }, [query.data?.series]);

  return {
    ...query,
    getSeriesByName
  };
}
