import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';

interface QuestionInputProps {
  selectedIds: string[];
  limit: number;
  onRelevantIdsUpdate: (ids: string[]) => void;
}

interface VotedQuestion {
  question: string;
  vote: 'good' | 'poor';
}

export default function QuestionInput({ selectedIds, limit, onRelevantIdsUpdate }: QuestionInputProps) {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [filterQuestion, setFilterQuestion] = useState<string | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const [votedQuestions, setVotedQuestions] = useState<VotedQuestion[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchVotedQuestions();
  }, []);

  const fetchVotedQuestions = async () => {
    try {
      const response = await fetch('/api/questionVote');
      const data = await response.json();
      setVotedQuestions(data);
    } catch (error) {
      console.error('Error fetching voted questions:', error);
    }
  };

  const handleAsk = async () => {
    if (!question.trim()) return;

    setIsLoading(true);
    setAnswer('');
    setFilterQuestion(undefined);
    setError(null);

    const params = new URLSearchParams({
      question: question,
      limit: limit.toString(),
    });

    if (selectedIds.length > 0) {
      params.append('selectedIds', selectedIds.join(','));
    }

    try {
      const response = await fetch(`/api/report?${params.toString()}`);
      const data = await response.json();
      
      if (response.ok) {
        setAnswer(data.answer);
        if (data.filterQuestion) {
          setFilterQuestion(data.filterQuestion);
        }
        if (data.relevantDocumentIds) {
          onRelevantIdsUpdate(data.relevantDocumentIds);
        }
      } else {
        setError(data.error || 'An unexpected error occurred');
      }
    } catch (error) {
      console.error('Error fetching answer:', error);
      setError('An error occurred while fetching the answer.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVote = async (vote: 'good' | 'poor') => {
    try {
      await fetch('/api/questionVote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, vote }),
      });
      fetchVotedQuestions();
    } catch (error) {
      console.error('Error voting for question:', error);
    }
  };

  const handleDeleteQuestion = async (questionToDelete: string) => {
    try {
      await fetch('/api/questionVote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: questionToDelete, action: 'delete' }),
      });
      fetchVotedQuestions();
    } catch (error) {
      console.error('Error deleting question:', error);
    }
  };

  const handlePreformattedQuestionClick = (q: string) => {
    setQuestion(q);
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
      
      <div className="mt-2">
        <h4 className="font-semibold mb-1">Well-performing questions:</h4>
        <div className="flex flex-wrap gap-2">
          {votedQuestions.filter(q => q.vote === 'good').map((q, index) => (
            <div key={index} className="flex items-center bg-gray-200 rounded dark:bg-gray-700">
              <button
                onClick={() => handlePreformattedQuestionClick(q.question)}
                className="px-3 py-1 text-sm hover:bg-gray-300 dark:hover:bg-gray-600"
              >
                {q.question}
              </button>
              <button
                onClick={() => handleDeleteQuestion(q.question)}
                className="px-2 py-1 text-sm text-red-500 hover:bg-gray-300 dark:hover:bg-gray-600"
                title="Delete question"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-2">
        <h4 className="font-semibold mb-1">Poor-performing questions:</h4>
        <div className="flex flex-wrap gap-2">
          {votedQuestions.filter(q => q.vote === 'poor').map((q, index) => (
            <div key={index} className="flex items-center bg-gray-200 rounded dark:bg-gray-700">
              <button
                onClick={() => handlePreformattedQuestionClick(q.question)}
                className="px-3 py-1 text-sm hover:bg-gray-300 dark:hover:bg-gray-600"
              >
                {q.question}
              </button>
              <button
                onClick={() => handleDeleteQuestion(q.question)}
                className="px-2 py-1 text-sm text-red-500 hover:bg-gray-300 dark:hover:bg-gray-600"
                title="Delete question"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </div>

      {(answer || filterQuestion || error) && (
        <div className="mt-4 p-4 bg-gray-100 dark:bg-gray-800 rounded">
          {filterQuestion && (
            <div className="mb-4">
              <h3 className="font-bold mb-2">Question used to filter documents:</h3>
              <p>{filterQuestion}</p>
            </div>
          )}
          {error ? (
            <div className="text-red-500">
              <h3 className="font-bold mb-2">Error:</h3>
              <p>{error}</p>
            </div>
          ) : answer && (
            <div>
              <h3 className="font-bold mb-2">Answer:</h3>
              <ReactMarkdown className="prose dark:prose-invert max-w-none">
                {answer}
              </ReactMarkdown>
              <div className="mt-2">
                <button
                  onClick={() => handleVote('good')}
                  className="mr-2 px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600"
                >
                  👍 Good
                </button>
                <button
                  onClick={() => handleVote('poor')}
                  className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600"
                >
                  👎 Poor
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}