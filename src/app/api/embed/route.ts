export const dynamic = 'force-dynamic'; // static by default, unless reading the request
import { MongoDBClient } from '../mongoclient';
import { ConversationDocument } from '../types';
import { PromisePool } from '../promisepool';
import OpenAI from "openai";

/**
 * Endpoint
 */
export async function POST(request: Request) {
    const { searchParams } = new URL(request.url);
    const textToEmbed = searchParams.get('text');

    if (textToEmbed) {
        // If a text parameter is provided, embed the single string
        const embedding = await getEmbedding(textToEmbed);
        return new Response(JSON.stringify({ embedding }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } else {
        // If no text parameter, proceed with the original functionality
        const mongoClient = MongoDBClient.getInstance();
        const conversations = await mongoClient.getConversations();
        await generateAndSaveEmbeddings(conversations);
        return new Response(JSON.stringify({ message: 'Embeddings generated and saved successfully' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

/**
 * Logic
 */

async function getEmbedding(text: string): Promise<number[]> {
    const openai = new OpenAI();
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
    const text = document.conversation.map((message) => message.role + ": " + message.content).join(' ');
    const embedding = await getEmbedding(text);
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
                return conversationWithEmbedding;
            });
        })
    );

    return conversationsWithEmbeddings;
}
