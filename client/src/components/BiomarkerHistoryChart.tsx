/**
    * @description      : 
    * @author           : 
    * @group            : 
    * @created          : 14/06/2025 - 00:54:04
    * 
    * MODIFICATION LOG
    * - Version         : 1.0.0
    * - Date            : 14/06/2025
    * - Author          : 
    * - Modification    : 
**/


import React from 'react';
import { LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { Series } from '@/types/chart';

const CHART_COLORS = {
  lipid: '#FF6B6B',
  metabolic: '#4ECDC4',
  thyroid: '#45B7D1',
  vitamin: '#96CEB4',
  blood: '#D4A5A5',
  liver: '#FFA07A',
  kidney: '#20B2AA',
  hormone: '#FFB6C1',
  mineral: '#9370DB',
  other: '#666666'
};

interface BiomarkerHistoryChartProps {
  series: Series[];
}

export function BiomarkerHistoryChart({ series }: BiomarkerHistoryChartProps) {
  // Process chart data - Move this hook before any conditional returns
  const chartData = React.useMemo(() => {
    try {
      console.log('📊 BiomarkerHistoryChart - Processing chart data for', series?.length || 0, 'series');
      
      // Early return if no series
      if (!series || series.length === 0) {
        return [];
      }
      
      // Validate series structure with better type checking
      const validSeries = series.filter(s => {
        const isValid = s && 
               typeof s === 'object' &&
               typeof s.name === 'string' &&
               s.points && 
               Array.isArray(s.points) && 
               s.points.length > 0 &&
               typeof s.unit === 'string' &&
               typeof s.category === 'string';
        
        if (!isValid) {
          console.warn('📊 Invalid series structure:', s);
        }
        return isValid;
      });
      
      if (validSeries.length === 0) {
        console.warn('📊 No valid series found after validation');
        return [];
      }
      
      // Get all unique dates across all series with better validation
      const dates = Array.from(
        new Set(validSeries.flatMap(s => 
          s.points
            .filter((p: any) => {
              const hasValidDate = p && p.testDate && typeof p.testDate === 'string';
              const hasValidValue = p && p.value !== null && p.value !== undefined && !isNaN(Number(p.value));
              return hasValidDate && hasValidValue;
            })
            .map((p: { testDate: string }) => p.testDate)
        ))
      ).sort();
      
      console.log('📊 Found', dates.length, 'unique dates:', dates.slice(0, 5));
      
      if (dates.length === 0) {
        console.warn('📊 No valid dates found in series data');
        return [];
      }
      
      // Create data points for each date
      const data = dates.map(date => {
        const entry: Record<string, any> = { testDate: date };
        validSeries.forEach(s => {
          const point = s.points.find((p: { testDate: string; value: number }) => p.testDate === date);
          if (point && point.value !== null && point.value !== undefined && !isNaN(Number(point.value))) {
            entry[s.name] = Number(point.value);
            entry[`${s.name}_unit`] = s.unit || '';
          }
        });
        return entry;
      });
      
      console.log('📊 Processed chart data:', {
        dataPoints: data.length,
        sampleData: data.slice(0, 2)
      });
      
      return data;
    } catch (error) {
      console.error('📊 Error processing chart data:', error);
      return [];
    }
  }, [JSON.stringify(series)]); // Use JSON.stringify to properly detect changes in series array

  // Debug logging
  React.useEffect(() => {
    console.log('📊 BiomarkerHistoryChart - Received series:', {
      seriesCount: series?.length || 0,
      seriesNames: series?.map(s => s.name) || [],
      sampleSeries: series?.slice(0, 2).map(s => ({
        name: s.name,
        pointCount: s.points?.length || 0,
        unit: s.unit,
        category: s.category
      })) || []
    });
  }, [series]);

  // Show empty chart template if no series selected
  if (!series || series.length === 0) {
    console.log('📊 BiomarkerHistoryChart - Showing empty state');
    return (
      <div className="w-full h-[600px] bg-white rounded-lg p-4 shadow-sm">
        <div className="mb-4">
          <h3 className="text-lg font-semibold">Biomarker History</h3>
          <p className="text-sm text-gray-600">
            Select biomarkers above to view their trends over time
          </p>
        </div>
        <div className="flex items-center justify-center h-[500px] border-2 border-dashed border-gray-200 rounded-lg">
          <div className="text-center">
            <div className="text-gray-400 mb-2">
              <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <p className="text-gray-500 font-medium">Chart will appear here</p>
            <p className="text-gray-400 text-sm">Click biomarker buttons above to add data</p>
          </div>
        </div>
      </div>
    );
  }

  // If no data after processing, show message
  if (chartData.length === 0) {
    console.log('📊 BiomarkerHistoryChart - No chart data available');
    return (
      <div className="flex items-center justify-center h-64 bg-white rounded-lg shadow-sm">
        <div className="text-center">
          <p className="text-gray-500 font-medium">No data points available</p>
          <p className="text-gray-400 text-sm">Selected biomarkers have no data to display</p>
        </div>
      </div>
    );
  }

  console.log('📊 BiomarkerHistoryChart - Rendering chart with', chartData.length, 'data points');

  return (
    <div className="w-full h-[600px] bg-white rounded-lg p-4 shadow-sm">
      <div className="mb-4">
        <h3 className="text-lg font-semibold">Biomarker History</h3>
        <p className="text-sm text-gray-600">
          Showing {series.length} biomarker{series.length > 1 ? 's' : ''} with {chartData.length} data point{chartData.length > 1 ? 's' : ''}
        </p>
      </div>
      
      <ResponsiveContainer width="100%" height="90%">
        <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis 
            dataKey="testDate" 
            tickFormatter={date => {
              try {
                return new Date(date).toLocaleDateString();
              } catch {
                return date;
              }
            }}
            stroke="#666"
          />
          <YAxis 
            stroke="#666"
            label={{ 
              value: series[0]?.unit || '', 
              angle: -90, 
              position: 'insideLeft',
              offset: 10
            }}
          />
          <Tooltip
            labelFormatter={label => {
              try {
                return new Date(label).toLocaleDateString();
              } catch {
                return label;
              }
            }}
            formatter={(value: any, name: any, props: any) => {
              try {
                const unit = props?.payload?.[`${name}_unit`] || '';
                return [`${value} ${unit}`, name];
              } catch {
                return [value, name];
              }
            }}
            contentStyle={{
              backgroundColor: 'rgba(255, 255, 255, 0.95)',
              border: '1px solid #f0f0f0',
              borderRadius: '4px'
            }}
          />
          <Legend />
          {series.filter(s => s && s.name && s.unit).map((s) => (
            <Line
              key={s.name}
              type="monotone"
              dataKey={s.name}
              stroke={CHART_COLORS[s.category as keyof typeof CHART_COLORS] || CHART_COLORS.other}
              strokeWidth={2}
              dot={true}
              activeDot={{ r: 6, strokeWidth: 1 }}
              name={`${s.name} ${s.unit ? `(${s.unit})` : ''}`}
              connectNulls={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

