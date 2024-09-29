export const dynamic = 'force-dynamic'; // static by default, unless reading the request
import { MongoDBClient } from '../mongoclient';
import { ConversationDocument } from '../types';
import OpenAI from "openai";
import { estimateTokens } from '../utilities';
import { PromisePool } from '../promisepool';

// const MAX_INPUT_TOKENS = 128000;
// const MAX_OUTPUT_TOKENS = 16000;
const GPT_4o_MINI = "gpt-4o-mini";
const MAX_BATCH_TOKENS = 8000;
const MAX_OUTPUT_TOKENS = 1000;

interface SummaryResult {
    docId: string;
    summary: string;
    wasUpdated: boolean;
}

/**
 * Endpoint
 */

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const limit = Number(searchParams.get('limit')) || undefined;
    const ids = searchParams.get('ids')?.split(',') || [];
    const saveToDocument = searchParams.get('saveToDocument') === 'true';

    const mongoClient = MongoDBClient.getInstance();
    let documents: Pick<ConversationDocument, '_id' | 'conversation'>[];

    if (ids.length > 0) {
        documents = await mongoClient.getConversationsByIds(ids);
    } else {
        documents = await mongoClient.getConversations(limit);
    }

    const result = await summarize(documents, saveToDocument);

    return new Response(JSON.stringify(result), {
        status: 200,
        headers: {
            'Content-Type': 'application/json'
        }
    });
}

async function summarize(documents: Pick<ConversationDocument, '_id' | 'conversation'>[], saveToDocument: boolean): Promise<SummaryResult[]> {
    const batches: Pick<ConversationDocument, '_id' | 'conversation'>[][] = [];
    let currentBatch: Pick<ConversationDocument, '_id' | 'conversation'>[] = [];
    let currentBatchTokens = 0;

    // Split documents into batches based on token count
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

    // Use PromisePool to process batches
    const pool = new PromisePool(5); // Adjust concurrency as needed
    const batchResults = await Promise.all(
        batches.map(batch => pool.add(() => processBatch(batch, saveToDocument)))
    );

    return batchResults.flat();
}

async function processBatch(batch: Pick<ConversationDocument, '_id' | 'conversation'>[], saveToDocument: boolean): Promise<SummaryResult[]> {
    const openai = new OpenAI();
    const conversationsBlob = batch.map((doc) => doc.conversation.map((message) => `${message.role}: ${message.content}`).join(' ')).join(' --- NEXT CONVERSATION --- ');

    const prompt = `
You are a helpful assistant that summarizes conversations. Each conversation should be summarized in a single, concise bullet point.
Conversations are separated by "--- NEXT CONVERSATION ---".
Provide one bullet point for each conversation, describing only the main topic.
If a conversation is inappropriate, mark it as "INAPPROPRIATE TO SUMMARIZE" instead of summarizing.
Do not use any formatting or special characters other than the bullet point itself.
Ensure that the number of bullet points matches the number of conversations.

Conversations:
${conversationsBlob}

Summary (one bullet point per line):
`;

    const response = await openai.chat.completions.create({
        model: GPT_4o_MINI,
        messages: [
            { role: "system", content: prompt },
        ],
        max_tokens: MAX_OUTPUT_TOKENS,
    });

    const summaries = response.choices[0].message.content?.split('\n') || ["Error summarizing conversations."];

    const mongoClient = MongoDBClient.getInstance();
    let updatedCount = 0;
    const results: SummaryResult[] = await Promise.all(
        batch.map(async (doc, index) => {
            const summary = summaries[index]?.trim() || "No summary available.";
            if (saveToDocument) {
                const { wasUpdated } = await mongoClient.updateConversationSummary(doc._id, summary);
                if (wasUpdated) updatedCount++;
                return { docId: doc._id.toString(), summary, wasUpdated };
            } else {
                return { docId: doc._id.toString(), summary, wasUpdated: false };
            }
        })
    );

    if (saveToDocument) {
        console.log(`Batch processed: ${updatedCount}/${batch.length} documents updated`);
    }

    return results;
}
