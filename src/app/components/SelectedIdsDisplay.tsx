import React from 'react';

interface SelectedIdsDisplayProps {
  selectedIds: string[];
  onIdClick: (id: string) => void;
}

const SelectedIdsDisplay: React.FC<SelectedIdsDisplayProps> = ({ selectedIds, onIdClick }) => {
  if (selectedIds.length === 0) {
    return null;
  }

  // Function to get the last 6 characters of an ID
  const getShortId = (id: string) => id.slice(-6);

  return (
    <div className="mt-4 p-4 bg-gray-100 rounded-md">
      <h3 className="font-semibold mb-2 flex items-center">
        <span className="w-4 h-4 rounded-full bg-[#4ade80] mr-2"></span>
        Selected {selectedIds.length} Datapoints:
      </h3>
      <p className="text-sm break-all">
        {selectedIds.map((id) => (
          <button
            key={id}
            onClick={() => onIdClick(id)}
            className="text-blue-600 hover:underline mr-2"
          >
            {getShortId(id)}
          </button>
        ))}
      </p>
    </div>
  );
};

export default SelectedIdsDisplay;