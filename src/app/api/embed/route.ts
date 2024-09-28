export const dynamic = 'force-dynamic'; // static by default, unless reading the request
import { MongoDBClient } from '../mongoclient';
import { ConversationDocument } from '../types';
import { PromisePool } from '../promisepool';
import OpenAI from "openai";
/**
 * Endpoint
 */
export async function POST() {
    const mongoClient = MongoDBClient.getInstance();
    const conversations = await mongoClient.getConversations();
    await generateAndSaveEmbeddings(conversations);
}

/**
 * Logic
 */

async function getEmbedding(document: ConversationDocument): Promise<number[]> {
    const openai = new OpenAI();
    const text = document.conversation.map((message) => message.role + ": " + message.content).join(' ')
    const response = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: text,
        encoding_format: "float",
        dimensions: 256, // Using 256 dimensions for speed
    });
    return response.data[0].embedding;
}

async function generateAndSaveSingleEmbedding(document: ConversationDocument): Promise<ConversationDocument> {
    const mongoClient = MongoDBClient.getInstance();
    const embedding = await getEmbedding(document);
    await mongoClient.saveDocument({ ...document, embedding });
    return { ...document, embedding };
}


async function generateAndSaveEmbeddings(conversations: ConversationDocument[]): Promise<ConversationDocument[]> {
    const pool = new PromisePool(10);
    
    const conversationsWithEmbeddings = await Promise.all(
        conversations.map(async (conversation) => {
            return pool.add(async () => {
                const conversationWithEmbedding = await generateAndSaveSingleEmbedding(conversation);
                console.log(conversationWithEmbedding.embedding);
                return conversationWithEmbedding
            });
        })
    );

    return conversationsWithEmbeddings;
}
