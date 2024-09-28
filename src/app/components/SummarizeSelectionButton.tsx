import { useState } from 'react';

interface SummarizeSelectionButtonProps {
  selectedIds: string[];
}

export default function SummarizeSelectionButton({ selectedIds }: SummarizeSelectionButtonProps) {
  const [summary, setSummary] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSummarize = async () => {
    if (selectedIds.length === 0) {
      alert('Please select at least one conversation to summarize.');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`/api/summarize?ids=${selectedIds.join(',')}`);
      const data = await response.json();
      setSummary(data.summary);
    } catch (error) {
      console.error('Error fetching summary:', error);
      alert('An error occurred while fetching the summary.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="mt-4">
      <button
        onClick={handleSummarize}
        disabled={isLoading || selectedIds.length === 0}
        className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50"
      >
        {isLoading ? 'Summarizing...' : 'Summarize Selection'}
      </button>
      {summary && (
        <div className="mt-4">
          <h3 className="text-lg font-semibold mb-2">Summary:</h3>
          <ul className="list-disc pl-5">
            {summary.split('\n').map((item, index) => (
              <li key={index}>{item.trim()}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}