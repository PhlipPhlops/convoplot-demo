import React from 'react';

interface SelectedIdsDisplayProps {
  selectedIds: string[];
}

const SelectedIdsDisplay: React.FC<SelectedIdsDisplayProps> = ({ selectedIds }) => {
  if (selectedIds.length === 0) {
    return null;
  }

  // Function to get the last 6 characters of an ID
  const getShortId = (id: string) => id.slice(-6);

  return (
    <div className="mt-4 p-4 bg-gray-100 rounded-md">
      <h3 className="font-semibold mb-2">Selected {selectedIds.length} Datapoints:</h3>
      <p className="text-sm break-all">
        {selectedIds.map(getShortId).join(', ')}
      </p>
    </div>
  );
};

export default SelectedIdsDisplay;