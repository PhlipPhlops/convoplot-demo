'use client';
import React, { useEffect, useState } from 'react';
import styles from './ConversationData.module.css';

interface ConversationDataProps {
  selectedIds: string[];
}

interface Message {
  role: string;
  content: string;
}

interface Conversation {
  _id: string;
  conversation: Message[];
}

const ConversationData: React.FC<ConversationDataProps> = ({ selectedIds }) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  if (isLoading) {
    return <div className="text-center py-4">Loading conversation data...</div>;
  }

  if (error) {
    return <div className="text-center py-4 text-red-500">Error: {error}</div>;
  }

  return (
    <div className="grid grid-cols-1 gap-4 mt-4">
      {conversations.map((conversation) => (
        <div key={conversation._id} className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 overflow-hidden">
          <h3 className="text-lg font-semibold mb-2">Conversation <strong>{conversation._id.slice(-6)}</strong></h3>
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
        </div>
      ))}
    </div>
  );
};

export default ConversationData;