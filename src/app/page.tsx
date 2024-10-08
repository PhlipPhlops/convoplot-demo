'use client';
import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import SelectedIdsDisplay from './components/SelectedIdsDisplay';
import RelevantIdsDisplay from './components/RelevantIdsDisplay';
import ConversationData from './components/ConversationData';
import LimitDropdown from './components/LimitDropdown';
import QuestionInput from './components/QuestionInput';
import SelectedAndRelevantIdsDisplay from './components/SelectedAndRelevantIdsDisplay';
import IntroductionText from './components/IntroductionText';

// Dynamically import the CoordinateMap component
const CoordinateMap = dynamic(() => import('./components/CoordinateMap'), { ssr: false });

const YourComponent: React.FC = () => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [relevantIds, setRelevantIds] = useState<string[]>([]);
  const [limit, setLimit] = useState<number>(1000);
  const [scrollToId, setScrollToId] = useState<string | null>(null);

  const handleRelevantIdsUpdate = (ids: string[]) => {
    setRelevantIds(ids);
  };

  const handleIdClick = (id: string) => {
    setScrollToId(id);
  };

  const handleResetSelection = () => {
    setSelectedIds([]);
  };

  return (
    <div className="min-h-screen p-4 dark:bg-gray-900 dark:text-white">
      <div className="max-w-7xl mx-auto">
        <LimitDropdown limit={limit} setLimit={setLimit} />
        <div className="mt-4 overflow-hidden rounded-lg shadow-lg">
          <CoordinateMap
            selectedIds={selectedIds}
            setSelectedIds={setSelectedIds}
            limit={limit}
            relevantIds={relevantIds}
            onResetSelection={handleResetSelection}
          />
        </div>
        <IntroductionText />
        <QuestionInput 
          selectedIds={selectedIds} 
          limit={limit} 
          onRelevantIdsUpdate={handleRelevantIdsUpdate}
        />
        <RelevantIdsDisplay relevantIds={relevantIds} onIdClick={handleIdClick} />
        <SelectedIdsDisplay selectedIds={selectedIds} onIdClick={handleIdClick} />
        <SelectedAndRelevantIdsDisplay 
          selectedIds={selectedIds} 
          relevantIds={relevantIds} 
          onIdClick={handleIdClick} 
        />
        <ConversationData 
          selectedIds={selectedIds} 
          relevantIds={relevantIds} 
          scrollToId={scrollToId}
        />
      </div>
    </div>
  );
};

export default YourComponent;
