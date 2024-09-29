import React from 'react';

interface RelevantIdsDisplayProps {
  relevantIds: string[];
  onIdClick: (id: string) => void;
}

const RelevantIdsDisplay: React.FC<RelevantIdsDisplayProps> = ({ relevantIds, onIdClick }) => {
  if (relevantIds.length === 0) {
    return null;
  }

  // Function to get the last 6 characters of an ID
  const getShortId = (id: string) => id.slice(-6);

  return (
    <div className="mt-4 p-4 bg-gray-100 rounded-md dark:bg-gray-800">
      <h3 className="font-semibold mb-2 flex items-center">
        <span className="w-4 h-4 rounded-full bg-[#9333ea] mr-2"></span>
        Question-Relevant {relevantIds.length} Datapoints:
      </h3>
      <p className="text-sm break-all">
        {relevantIds.map((id) => (
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

export default RelevantIdsDisplay;