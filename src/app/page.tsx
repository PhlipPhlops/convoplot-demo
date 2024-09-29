'use client';
import { useState } from 'react';
import dynamic from 'next/dynamic';
import SelectedIdsDisplay from './components/SelectedIdsDisplay';
import RelevantIdsDisplay from './components/RelevantIdsDisplay';
import ConversationData from './components/ConversationData';
import LimitDropdown from './components/LimitDropdown';
import SummarizeSelectionButton from './components/SummarizeSelectionButton';
import QuestionInput from './components/QuestionInput';

// Dynamically import the CoordinateMap component
const CoordinateMap = dynamic(() => import('./components/CoordinateMap'), { ssr: false });

export default function Home() {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [relevantIds, setRelevantIds] = useState<string[]>([]);
  const [limit, setLimit] = useState<number>(1000);

  const handleRelevantIdsUpdate = (ids: string[]) => {
    setRelevantIds(ids);
  };

  return (
    <div className="min-h-screen p-4 dark:bg-gray-900 dark:text-white">
      <div className="max-w-7xl mx-auto">
        <LimitDropdown limit={limit} setLimit={setLimit} />
        <div className="mt-4 overflow-hidden rounded-lg shadow-lg">
          <CoordinateMap selectedIds={selectedIds} setSelectedIds={setSelectedIds} limit={limit} relevantIds={relevantIds} />
        </div>
        <SelectedIdsDisplay selectedIds={selectedIds} />
        <QuestionInput 
          selectedIds={selectedIds} 
          limit={limit} 
          onRelevantIdsUpdate={handleRelevantIdsUpdate}
        />
        <RelevantIdsDisplay relevantIds={relevantIds} />
        <ConversationData selectedIds={selectedIds} relevantIds={relevantIds} />
      </div>
    </div>
  );
}
