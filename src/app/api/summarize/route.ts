export const dynamic = 'force-dynamic'; // static by default, unless reading the request
import { MongoDBClient } from '../mongoclient';
import { ConversationDocument } from '../types';
import OpenAI from "openai";
import { estimateTokens } from '../utilities';

// const MAX_INPUT_TOKENS = 128000;
// const MAX_OUTPUT_TOKENS = 16000;
const GPT_4o_MINI = "gpt-4o-mini";
const MAX_BATCH_TOKENS = 8000;
const MAX_OUTPUT_TOKENS = 1000;

/**
 * Endpoint
 */

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const limit = Number(searchParams.get('limit')) || undefined;
    const ids = searchParams.get('ids')?.split(',') || [];

    const mongoClient = MongoDBClient.getInstance();
    let documents: ConversationDocument[];

    if (ids.length > 0) {
        documents = await mongoClient.getConversationsByIds(ids);
    } else {
        documents = await mongoClient.getConversations(limit);
    }

    const summary = await summarize(documents);

    return new Response(JSON.stringify({ summary }), {
        status: 200,
        headers: {
            'Content-Type': 'application/json'
        }
    });
}

async function summarize(documents: ConversationDocument[]): Promise<string> {
    const batches: ConversationDocument[][] = [];
    let currentBatch: ConversationDocument[] = [];
    let currentBatchTokens = 0;

    // Split documents into batches
    for (const doc of documents) {
        const docTokens = estimateTokens(doc.conversation.map(message => `${message.role}: ${message.content}`).join(' '));
        if (currentBatchTokens + docTokens > MAX_BATCH_TOKENS && currentBatch.length > 0) {
            batches.push(currentBatch);
            currentBatch = [];
            currentBatchTokens = 0;
        }
        currentBatch.push(doc);
        currentBatchTokens += docTokens;
    }
    if (currentBatch.length > 0) {
        batches.push(currentBatch);
    }

    console.log(`Processing ${batches.length} batches...`);

    // Process batches in parallel
    const batchSummaries = await Promise.all(batches.map(processBatch));

    // Join all summaries
    return batchSummaries.join('\n');
}

async function processBatch(batch: ConversationDocument[]): Promise<string> {
    const openai = new OpenAI();
    const conversationsBlob = batch.map((doc) => doc.conversation.map((message) => `${message.role}: ${message.content}`).join(' ')).join(' --- NEXT CONVERSATION --- ');

    const prompt = `
You are a helpful assistant that summarizes conversations. Conversations are separated by "--- NEXT CONVERSATION ---".
Provide a single, unformatted bullet point for each conversation, describing only the main topic.
If a conversation is inappropriate, mark it as "INAPPROPRIATE TO SUMMARIZE" instead of summarizing.
Do not use any formatting or special characters other than the bullet point itself.

Conversations:
${conversationsBlob}

Summary (unformatted bullet points only):
`;

    const response = await openai.chat.completions.create({
        model: GPT_4o_MINI,
        messages: [
            { role: "system", content: prompt },
        ],
        max_tokens: MAX_OUTPUT_TOKENS,
    });

    return response.choices[0].message.content || "Error summarizing conversations.";
}
