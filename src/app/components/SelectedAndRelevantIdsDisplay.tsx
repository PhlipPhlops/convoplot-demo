import React from 'react';

interface SelectedAndRelevantIdsDisplayProps {
  selectedIds: string[];
  relevantIds: string[];
  onIdClick: (id: string) => void;
}

const SelectedAndRelevantIdsDisplay: React.FC<SelectedAndRelevantIdsDisplayProps> = ({ selectedIds, relevantIds, onIdClick }) => {
  const selectedAndRelevantIds = selectedIds.filter(id => relevantIds.includes(id));

  // Function to get the last 6 characters of an ID
  const getShortId = (id: string) => id.slice(-6);

  return (
    <div className="mt-4 p-4 bg-gray-100 rounded-md dark:bg-gray-800">
      <h3 className="font-semibold mb-2 flex items-center">
        <span className="w-4 h-4 rounded-full bg-[#f59e0b] mr-2"></span>
        Selected and Relevant Datapoints:
      </h3>
      {selectedAndRelevantIds.length > 0 ? (
        <p className="text-sm break-all">
          {selectedAndRelevantIds.map((id) => (
            <button
              key={id}
              onClick={() => onIdClick(id)}
              className="text-blue-600 hover:underline mr-2"
            >
              {getShortId(id)}
            </button>
          ))}
        </p>
      ) : (
        <p className="text-sm italic">
          None of the selectedIDs were found to be relevant by vector search
        </p>
      )}
    </div>
  );
};

export default SelectedAndRelevantIdsDisplay;