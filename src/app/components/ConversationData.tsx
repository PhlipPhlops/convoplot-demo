'use client';
import React, { useEffect, useState, useRef } from 'react';

interface ConversationDataProps {
  selectedIds: string[];
  relevantIds: string[];
  scrollToId: string | null;
}

interface Message {
  role: string;
  content: string;
}

interface Conversation {
  _id: string;
  conversation: Message[];
  summary: string;
}

const ConversationData: React.FC<ConversationDataProps> = ({ selectedIds, relevantIds, scrollToId }) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const conversationRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  useEffect(() => {
    const fetchConversations = async () => {
      if (selectedIds.length === 0) {
        setConversations([]);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const idsParam = selectedIds.join(',');
        const response = await fetch(`/api/data?dataType=ids&ids=${idsParam}`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch conversation data');
        }

        const data: Conversation[] = await response.json();
        setConversations(data);
      } catch (err) {
        setError('Error fetching conversation data');
        console.error('Error fetching conversation data:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchConversations();
  }, [selectedIds]);

  useEffect(() => {
    if (scrollToId && conversationRefs.current[scrollToId]) {
      conversationRefs.current[scrollToId]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [scrollToId]);

  const toggleCollapse = (id: string) => {
    setCollapsedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  if (isLoading) {
    return <div className="text-center py-4">Loading conversation data...</div>;
  }

  if (error) {
    return <div className="text-center py-4 text-red-500">Error: {error}</div>;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
      {conversations.map((conversation) => (
        <div 
          key={conversation._id} 
          ref={(el) => { conversationRefs.current[conversation._id] = el }}
          className={`bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 overflow-hidden ${
            relevantIds.includes(conversation._id) ? 'border-4 border-purple-500' : ''
          }`}
        >
          <div className="flex justify-between items-center mb-2">
            {relevantIds.includes(conversation._id) && (
              <p className="text-purple-500 italic text-sm">Relevant</p>
            )}
            <h3 className="text-lg font-semibold">Conversation <strong>{conversation._id.slice(-6)}</strong></h3>
            <button
              onClick={() => toggleCollapse(conversation._id)}
              className="px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded"
            >
              {collapsedIds.has(conversation._id) ? 'Expand' : 'Collapse'}
            </button>
          </div>
          {conversation.summary && (
            <p className="text-sm mb-2 italic">{conversation.summary}</p>
          )}
          {!collapsedIds.has(conversation._id) && (
            <div className="space-y-2">
              {conversation.conversation.map((message, index) => (
                <div
                  key={index}
                  className={`p-2 rounded-lg ${
                    message.role === 'assistant' 
                      ? 'bg-blue-100 dark:bg-blue-900 mr-8' 
                      : 'bg-green-100 dark:bg-green-900 ml-8'
                  }`}
                >
                  <div className="font-semibold text-xs mb-1">
                    {message.role}
                  </div>
                  <p className="text-sm break-words">{message.content}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default ConversationData;