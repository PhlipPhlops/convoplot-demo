export const dynamic = 'force-dynamic'; // static by default, unless reading the request

/**
 * Endpoint
 */

import { MongoDBClient } from '../mongoclient';
import { ConversationDocument } from '../types';
import OpenAI from "openai";
import { estimateTokens } from '../utilities';
import { PromisePool } from '../promisepool';

const GPT_4o_MINI = "gpt-4o-mini";
// const MAX_OUTPUT_TOKENS = 1000;
const MAX_BATCH_SIZE = 16000; // Adjust this value as needed

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const question = searchParams.get('question');
    const ids = searchParams.get('ids')?.split(',') || [];
    const limit = Number(searchParams.get('limit')) || undefined;

    if (!question) {
        return new Response(JSON.stringify({ error: 'Question is required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    const mongoClient = MongoDBClient.getInstance();
    let documents: Pick<ConversationDocument, '_id' | 'conversation'>[];

    if (ids.length > 0) {
        documents = await mongoClient.getConversationsByIds(ids);
    } else {
        documents = await mongoClient.getConversations(limit);
    }

    const relevantDocuments = await filterDocuments(documents, question);
    const answer = await answerQuestion(question, relevantDocuments);

    // Extract the document IDs from the relevant documents
    const relevantDocumentIds = relevantDocuments.map(doc => doc._id.toString());

    return new Response(JSON.stringify({
        question,
        answer,
        relevantDocumentsCount: relevantDocuments.length,
        relevantDocumentIds: relevantDocumentIds
    }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
    });
}

async function filterDocuments(documents: Pick<ConversationDocument, '_id' | 'conversation'>[], originalQuestion: string): Promise<Pick<ConversationDocument, '_id' | 'conversation'>[]> {
    let relevantDocuments: Pick<ConversationDocument, '_id' | 'conversation'>[] = documents;

    // Only apply batch filter if total tokens are above MAX_BATCH_SIZE
    if (estimateTotalTokens(documents) > MAX_BATCH_SIZE) {
        relevantDocuments = await batchFilter(documents, originalQuestion, 5); // Sample size of 5
    }

    // Second stage: Individual document filtration if still above MAX_BATCH_SIZE
    if (estimateTotalTokens(relevantDocuments) > MAX_BATCH_SIZE) {
        relevantDocuments = await individualFilter(relevantDocuments, originalQuestion);
    }

    return relevantDocuments;
}

async function batchFilter(
    documents: Pick<ConversationDocument, '_id' | 'conversation'>[],
    originalQuestion: string,
    sampleSize: number
): Promise<Pick<ConversationDocument, '_id' | 'conversation'>[]> {
    const openai = new OpenAI();
    const batches: Pick<ConversationDocument, '_id' | 'conversation'>[][] = [];

    // Split documents into batches of sampleSize
    for (let i = 0; i < documents.length; i += sampleSize) {
        batches.push(documents.slice(i, i + sampleSize));
    }

    const pool = new PromisePool(5); // Adjust concurrency as needed
    const relevantDocuments: Pick<ConversationDocument, '_id' | 'conversation'>[] = [];

    await Promise.all(batches.map(batch => pool.add(async () => {
        const batchText = batch.map(doc => 
            doc.conversation.map(message => `${message.role}: ${message.content}`).join('\n')
        ).join('\n\n--- NEXT CONVERSATION ---\n\n');

        const prompt = `
Incoming question:
${originalQuestion}

Batch of conversations:
${batchText}

Determine if any of the conversations in this batch could at all be useful in answering the incoming question.
Return a JSON object with a single 'isRelevant' property. Set it to true if at least one conversation is relevant, false otherwise.

Your response must be a valid JSON object.`;

        const response = await openai.chat.completions.create({
            model: GPT_4o_MINI,
            messages: [
                { role: "system", content: prompt },
            ],
            response_format: { type: "json_object" },
            max_tokens: 10,
        });

        const result = JSON.parse(response.choices[0].message.content || '{"isRelevant": false}');
        if (result.isRelevant) {
            relevantDocuments.push(...batch);
        }
    })));

    return relevantDocuments;
}

function estimateTotalTokens(documents: Pick<ConversationDocument, '_id' | 'conversation'>[]): number {
    return documents.reduce((total, doc) => 
        total + estimateTokens(doc.conversation.map(message => `${message.role}: ${message.content}`).join(' ')),
        0
    );
}

async function individualFilter(
    documents: Pick<ConversationDocument, '_id' | 'conversation'>[],
    originalQuestion: string
): Promise<Pick<ConversationDocument, '_id' | 'conversation'>[]> {
    const openai = new OpenAI();
    const pool = new PromisePool(5); // Adjust concurrency as needed
    const relevantDocuments: Pick<ConversationDocument, '_id' | 'conversation'>[] = [];

    await Promise.all(documents.map(doc => pool.add(async () => {
        const docText = doc.conversation.map(message => `${message.role}: ${message.content}`).join('\n');

        const prompt = `
${originalQuestion}

Conversation:
${docText}

Determine if this conversation is relevant to the original question.
Return a JSON object with a single 'isRelevant' property. Set it to true if the conversation is relevant, false otherwise.

Your response must be a valid JSON object.`;

        const response = await openai.chat.completions.create({
            model: GPT_4o_MINI,
            messages: [
                { role: "system", content: prompt },
            ],
            response_format: { type: "json_object" },
            max_tokens: 10,
        });

        const result = JSON.parse(response.choices[0].message.content || '{"isRelevant": false}');
        if (result.isRelevant) {
            relevantDocuments.push(doc);
        }
    })));

    return relevantDocuments;
}

async function answerQuestion(question: string, documents: Pick<ConversationDocument, '_id' | 'conversation'>[]): Promise<string> {
    const openai = new OpenAI();
    const conversationsBlob = documents.map((doc) => doc.conversation.map((message) => `${message.role}: ${message.content}`).join('\n')).join('\n\n--- NEXT CONVERSATION ---\n\n');

    const prompt = `
You are an extremely clever and succinct assitant that answers questions based on the provided conversations.
All "documents" refer to conversations between a user and an AI assistant.
Use the information from the conversations to answer the question as accurately and helpfully as possible.
You must answer the question or obey the request truthfully and accurately using ONLY information from the conversations provided as insight. If the answer is not in the conversations, say so.

You MUST answer the question, and provide no other information.

Question: ${question}

Conversations:
${conversationsBlob}

---
Question, repeated: ${question}
`;

    const response = await openai.chat.completions.create({
        model: GPT_4o_MINI,
        messages: [
            { role: "user", content: prompt },
        ],
    });

    return response.choices[0].message.content?.trim() || "Unable to answer the question based on the provided conversations.";
}
