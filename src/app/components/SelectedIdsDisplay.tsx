import React from 'react';

interface SelectedIdsDisplayProps {
  selectedIds: string[];
}

const SelectedIdsDisplay: React.FC<SelectedIdsDisplayProps> = ({ selectedIds }) => {
  if (selectedIds.length === 0) {
    return null;
  }

  return (
    <div className="mt-4 p-4 bg-gray-100 rounded-md">
      <h3 className="font-semibold mb-2">Selected IDs:</h3>
      <p className="text-sm break-all">{selectedIds.join(', ')}</p>
    </div>
  );
};

export default SelectedIdsDisplay;