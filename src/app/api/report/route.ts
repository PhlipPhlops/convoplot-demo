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

    const filterQuestion = await generateFilterQuestion(question);
    const relevantDocuments = await filterDocuments(documents, filterQuestion);
    const answer = await answerQuestion(question, relevantDocuments);

    // Extract the document IDs from the relevant documents
    const relevantDocumentIds = relevantDocuments.map(doc => doc._id.toString());

    return new Response(JSON.stringify({
        question,
        filterQuestion,
        answer,
        relevantDocumentsCount: relevantDocuments.length,
        relevantDocumentIds: relevantDocumentIds
    }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
    });
}

async function generateFilterQuestion(originalQuestion: string): Promise<string> {
    const openai = new OpenAI();
    const prompt = `
Given the following question, create a yes/no filter question that can determine if any of the conversations in a batch is relevant to answering the original question.

Original question: "${originalQuestion}"

Your task is to generate a filter question. This filter question will be used to determine if a batch of conversations contains any relevant information to answer the original question.

Inside the filter question, describe a few creative examples of things that MAY be relevant to answering the original question.

Respond with a JSON object containing a single 'filterQuestion' property. The value should be the generated filter question.

Your response must be a valid JSON object.`;

    const response = await openai.chat.completions.create({
        model: GPT_4o_MINI,
        messages: [
            { role: "system", content: prompt },
        ],
        response_format: { type: "json_object" },
        max_tokens: 100,
    });

    const result = JSON.parse(response.choices[0].message.content || '{"filterQuestion": "Is this conversation relevant to the original question?"}');
    return result.filterQuestion;
}

async function filterDocuments(documents: Pick<ConversationDocument, '_id' | 'conversation'>[], filterQuestion: string): Promise<Pick<ConversationDocument, '_id' | 'conversation'>[]> {
    let relevantDocuments = await batchFilter(documents, filterQuestion, MAX_BATCH_SIZE);

    // If the filtered documents are still too large, filter again with half the batch size
    if (estimateTotalTokens(relevantDocuments) > MAX_BATCH_SIZE) {
        relevantDocuments = await batchFilter(relevantDocuments, filterQuestion, MAX_BATCH_SIZE / 2);
    }

    return relevantDocuments;
}

async function batchFilter(
    documents: Pick<ConversationDocument, '_id' | 'conversation'>[],
    filterQuestion: string,
    batchSize: number
): Promise<Pick<ConversationDocument, '_id' | 'conversation'>[]> {
    const openai = new OpenAI();
    const batches: Pick<ConversationDocument, '_id' | 'conversation'>[][] = [];
    let currentBatch: Pick<ConversationDocument, '_id' | 'conversation'>[] = [];
    let currentBatchTokens = 0;

    // Split documents into batches based on token count
    for (const doc of documents) {
        const docTokens = estimateTokens(doc.conversation.map(message => `${message.role}: ${message.content}`).join(' '));
        if (currentBatchTokens + docTokens > batchSize && currentBatch.length > 0) {
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

    const pool = new PromisePool(5); // Adjust concurrency as needed
    const relevantDocuments: Pick<ConversationDocument, '_id' | 'conversation'>[] = [];

    await Promise.all(batches.map(batch => pool.add(async () => {
        const batchText = batch.map(doc => 
            doc.conversation.map(message => `${message.role}: ${message.content}`).join('\n')
        ).join('\n\n--- NEXT CONVERSATION ---\n\n');

        const prompt = `
${filterQuestion}

Batch of conversations:
${batchText}

Determine if any of the conversations in this batch are relevant to the filter question.
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
