import { useState } from 'react';

interface QuestionInputProps {
  selectedIds: string[];
  limit: number;
  onRelevantIdsUpdate: (ids: string[]) => void;
}

export default function QuestionInput({ selectedIds, limit, onRelevantIdsUpdate }: QuestionInputProps) {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [filterQuestion, setFilterQuestion] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleAsk = async () => {
    if (!question.trim()) return;

    setIsLoading(true);
    setAnswer('');
    setFilterQuestion('');

    const params = new URLSearchParams({
      question: question,
      limit: limit.toString(),
    });

    if (selectedIds.length > 0) {
      params.append('ids', selectedIds.join(','));
    }

    try {
      const response = await fetch(`/api/report?${params.toString()}`);
      const data = await response.json();
      setAnswer(data.answer);
      setFilterQuestion(data.filterQuestion);
      // Update relevant IDs
      if (data.relevantDocumentIds) {
        onRelevantIdsUpdate(data.relevantDocumentIds);
      }
    } catch (error) {
      console.error('Error fetching answer:', error);
      setAnswer('An error occurred while fetching the answer.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="mt-4">
      <div className="flex">
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Draw a circle to select conversations, and ask a question..."
          className="flex-grow p-2 border rounded-l dark:bg-gray-700 dark:border-gray-600"
        />
        <button
          onClick={handleAsk}
          disabled={isLoading}
          className="px-4 py-2 bg-blue-500 text-white rounded-r hover:bg-blue-600 disabled:bg-blue-300"
        >
          {isLoading ? 'Loading...' : 'Ask'}
        </button>
      </div>
      {(filterQuestion || answer) && (
        <div className="mt-4 p-4 bg-gray-100 dark:bg-gray-800 rounded">
          {filterQuestion && (
            <div className="mb-4">
              <h3 className="font-bold mb-2">Question used to filter documents:</h3>
              <p>{filterQuestion}</p>
            </div>
          )}
          {answer && (
            <div>
              <h3 className="font-bold mb-2">Answer:</h3>
              <p>{answer}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}