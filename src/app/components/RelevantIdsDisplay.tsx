import React from 'react';

interface RelevantIdsDisplayProps {
  relevantIds: string[];
}

const RelevantIdsDisplay: React.FC<RelevantIdsDisplayProps> = ({ relevantIds }) => {
  if (relevantIds.length === 0) {
    return null;
  }

  // Function to get the last 6 characters of an ID
  const getShortId = (id: string) => id.slice(-6);

  return (
    <div className="mt-4 p-4 bg-gray-100 rounded-md dark:bg-gray-800">
      <h3 className="font-semibold mb-2">Question-Relevant {relevantIds.length} Datapoints:</h3>
      <p className="text-sm break-all">
        {relevantIds.map(getShortId).join(', ')}
      </p>
    </div>
  );
};

export default RelevantIdsDisplay;