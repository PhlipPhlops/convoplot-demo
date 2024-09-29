export const dynamic = 'force-dynamic'; // static by default, unless reading the request
import { MongoDBClient } from '../mongoclient';
import { ConversationDocument } from '../types';
import OpenAI from "openai";
// import { estimateTokens } from '../utilities';
import { PromisePool } from '../promisepool';

// const MAX_INPUT_TOKENS = 128000;
// const MAX_OUTPUT_TOKENS = 16000;
const GPT_4o_MINI = "gpt-4o-mini";
// const MAX_BATCH_TOKENS = 8000;
const MAX_OUTPUT_TOKENS = 1000;
const MAX_RETRIES = 5;
const INITIAL_BACKOFF = 1000; // 1 second

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
    console.log(`Starting to process ${documents.length} documents...`);

    let processedCount = 0;
    let updatedCount = 0;
    const totalDocuments = documents.length;

    const pool = new PromisePool(50); // Reduced concurrency to help with rate limiting
    const results = await Promise.all(
        documents.map(doc => pool.add(async () => {
            const result = await processDocumentWithRetry(doc, saveToDocument);
            processedCount++;
            if (result.wasUpdated) {
                updatedCount++;
            }
            if (processedCount % 100 === 0) {
                console.log(`Progress: ${processedCount}/${totalDocuments} documents processed (${Math.round(processedCount / totalDocuments * 100)}%, ${updatedCount} updated)`);
            }
            return result;
        }))
    );

    console.log(`Finished processing all ${totalDocuments} documents.`);
    return results;
}

async function processDocumentWithRetry(doc: Pick<ConversationDocument, '_id' | 'conversation'>, saveToDocument: boolean, retryCount = 0): Promise<SummaryResult> {
    try {
        return await processDocument(doc, saveToDocument);
    } catch (error) {
        if (error instanceof OpenAI.APIError && error.code === 'rate_limit_exceeded' && retryCount < MAX_RETRIES) {
            const backoffTime = INITIAL_BACKOFF * Math.pow(2, retryCount);
            console.log(`Rate limit reached. Retrying in ${backoffTime}ms...`);
            await new Promise(resolve => setTimeout(resolve, backoffTime));
            return processDocumentWithRetry(doc, saveToDocument, retryCount + 1);
        } else {
            throw error;
        }
    }
}

async function processDocument(doc: Pick<ConversationDocument, '_id' | 'conversation'>, saveToDocument: boolean): Promise<SummaryResult> {
    const openai = new OpenAI();
    const conversationBlob = doc.conversation.map((message) => `${message.role}: ${message.content}`).join(' ');

    const prompt = `
You are a helpful assistant that summarizes a single conversation. Provide one concise bullet point describing only the main topic of the conversation.
If the conversation is inappropriate, mark it as "INAPPROPRIATE TO SUMMARIZE" instead of summarizing.
Do not use any formatting or special characters other than the bullet point itself.

Conversation:
${conversationBlob}

Summary (one bullet point):
`;

    const response = await openai.chat.completions.create({
        model: GPT_4o_MINI,
        messages: [
            { role: "system", content: prompt },
        ],
        max_tokens: MAX_OUTPUT_TOKENS,
    });

    const summary = response.choices[0].message.content?.trim() || "No summary available.";

    const mongoClient = MongoDBClient.getInstance();
    let wasUpdated = false;

    if (saveToDocument) {
        const result = await mongoClient.updateConversationSummary(doc._id, summary);
        wasUpdated = result.wasUpdated;
    }

    return { docId: doc._id.toString(), summary, wasUpdated };
}
