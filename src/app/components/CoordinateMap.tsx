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
  relevantIds: string[];
  onResetSelection: () => void;  // Add this line
}

const CoordinateMap: React.FC<CoordinateMapProps> = ({ selectedIds, setSelectedIds, limit, relevantIds, onResetSelection }) => {
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

  // Split coordinates into three groups
  const relevantCoords = coordinates.filter(coord => relevantIds.includes(coord._id));
  const selectedCoords = coordinates.filter(coord => selectedIds.includes(coord._id) && !relevantIds.includes(coord._id));
  const otherCoords = coordinates.filter(coord => !relevantIds.includes(coord._id) && !selectedIds.includes(coord._id));

  // Helper function to create a trace
  const createTrace = (coords: Coordinate[], color: string, size: number, opacity: number) => ({
    x: coords.map(coord => coord.coordinates[0]),
    y: coords.map(coord => coord.coordinates[1]),
    type: 'scatter' as const,
    mode: 'markers' as const,
    marker: { 
      color,
      size,
      opacity,
      line: {
        color: 'white',
        width: 1
      }
    },
    text: coords.map(coord => 
      coord.summary || `No summary: (${coord.coordinates[0].toFixed(2)}, ${coord.coordinates[1].toFixed(2)})`
    ),
    hoverinfo: 'text' as const,
  });

  // Calculate the center and range of the coordinates
  const allX = coordinates.map(coord => coord.coordinates[0]);
  const allY = coordinates.map(coord => coord.coordinates[1]);
  const xCenter = (Math.min(...allX) + Math.max(...allX)) / 2;
  const yCenter = (Math.min(...allY) + Math.max(...allY)) / 2;
  const range = Math.max(Math.max(...allX) - Math.min(...allX), Math.max(...allY) - Math.min(...allY)) * 1.1;

  return (
    <div className="w-full h-[400px] md:h-[600px] relative">
      <Plot
        data={[
          createTrace(otherCoords, '#0000FF', 6, 0.7),
          createTrace(selectedCoords, '#4ade80', 10, 1),
          createTrace(relevantCoords, '#9333ea', 10, 1),
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
      <button
        className="absolute bottom-4 right-4 bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
        onClick={onResetSelection}
      >
        Reset Selection
      </button>
    </div>
  );
};

export default CoordinateMap;