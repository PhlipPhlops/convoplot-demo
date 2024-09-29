'use client';
import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';

// Dynamically import Plotly to avoid SSR issues
const Plot = dynamic(() => import('react-plotly.js').then(mod => mod.default), { ssr: false });

interface Coordinate {
  _id: string;
  coordinates: [number, number];
  summary?: string;
}

interface CoordinateMapProps {
  selectedIds: string[];
  setSelectedIds: React.Dispatch<React.SetStateAction<string[]>>;
  limit: number;
}

const CoordinateMap: React.FC<CoordinateMapProps> = ({ selectedIds, setSelectedIds, limit }) => {
  const [coordinates, setCoordinates] = useState<Coordinate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  // Remove the unused state
  // const [plotKey, setPlotKey] = useState(0);

  useEffect(() => {
    const fetchCoordinates = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/data?dataType=coords&limit=${limit}`);
        if (!response.ok) {
          throw new Error('Failed to fetch coordinates');
        }
        const data: Coordinate[] = await response.json();
        setCoordinates(data);
      } catch (error) {
        console.error('Error fetching coordinates:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCoordinates();
  }, [limit]);

  const handleSelection = (event: Plotly.PlotSelectionEvent) => {
    if (event.points && event.points.length > 0) {
      const ids = event.points.map(point => coordinates[point.pointIndex]._id);
      setSelectedIds(ids);
    }
  };

  const handleDeselect = () => {
    setSelectedIds([]);
  };

  if (isLoading) {
    return (
      <div className="w-full h-[400px] md:h-[600px] flex flex-col items-center justify-center">
        <div className="w-16 h-16 border-t-4 border-blue-500 border-solid rounded-full animate-spin"></div>
        <p className="mt-4 text-lg font-semibold">Loading {limit.toLocaleString()} Datapoints</p>
      </div>
    );
  }

  const xValues = coordinates.map(coord => coord.coordinates[0]);
  const yValues = coordinates.map(coord => coord.coordinates[1]);

  // Calculate the center and range of the coordinates
  const xCenter = (Math.min(...xValues) + Math.max(...xValues)) / 2;
  const yCenter = (Math.min(...yValues) + Math.max(...yValues)) / 2;
  const xRange = Math.max(...xValues) - Math.min(...xValues);
  const yRange = Math.max(...yValues) - Math.min(...yValues);
  const range = Math.max(xRange, yRange) * 1.1; // Add 10% padding

  return (
    <div className="w-full h-[400px] md:h-[600px]">
      <Plot
        data={[
          {
            x: xValues,
            y: yValues,
            type: 'scatter',
            mode: 'markers',
            marker: { 
              color: coordinates.map(coord => 
                selectedIds.includes(coord._id) ? 'red' : 'blue'
              ),
              size: coordinates.map(coord => 
                selectedIds.includes(coord._id) ? 8 : 6
              ),
            },
            text: coordinates.map(coord => 
              coord.summary || `No summary: (${coord.coordinates[0].toFixed(2)}, ${coord.coordinates[1].toFixed(2)})`
            ),
            hoverinfo: 'text',
          },
        ]}
        layout={{
          title: 'UMAP clustering of Conversation Data',
          autosize: true,
          margin: { l: 50, r: 50, b: 50, t: 50, pad: 4 },
          xaxis: { 
            showticklabels: false, 
            title: '',
            range: [xCenter - range/2, xCenter + range/2],
          },
          yaxis: { 
            showticklabels: false, 
            title: '',
            range: [yCenter - range/2, yCenter + range/2],
          },
          dragmode: 'lasso',
          hovermode: 'closest',
          paper_bgcolor: 'rgba(0,0,0,0)',
          plot_bgcolor: 'rgba(0,0,0,0)',
          font: { color: 'currentColor' },
        }}
        config={{
          modeBarButtonsToRemove: ['select2d', 'lasso2d'],
          displayModeBar: true,
          displaylogo: false,
        }}
        useResizeHandler={true}
        style={{ width: '100%', height: '100%' }}
        onSelected={handleSelection}
        onDeselect={handleDeselect}
      />
    </div>
  );
};

export default CoordinateMap;