import { ObjectId } from 'mongodb';

export interface ConversationDocument {
    _id: ObjectId;
    conversation_id: string;
    model: string;
    conversation: Array<{
        role: string;
        content: string;
    }>;
    turn: number;
    language: string;
    redacted: boolean;
    embedding?: number[];
    coordinates?: number[];
}
