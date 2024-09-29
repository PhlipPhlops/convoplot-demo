import { MongoDBClient } from '../mongoclient';
import { ConversationDocument } from '../types';
import OpenAI from "openai";
import { estimateTokens } from '../utilities';

const GPT_4o_MINI = "gpt-4o-mini";
const NUM_CANDIDATES = 50;
const LIMIT = 5;
const MAX_BATCH_SIZE = 16000; // Adjust this value as needed

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const question = searchParams.get('question');
    const limit = Number(searchParams.get('limit')) || LIMIT;
    const selectedIds = searchParams.get('selectedIds')?.split(',') || [];
    const mongoClient = MongoDBClient.getInstance();
    await mongoClient.connect();

    if (!question) {
        return new Response(JSON.stringify({ error: 'Question is required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    try {
        // Generate embedding for the question
        const embedding = await getEmbedding(question);

        const searchResults = await mongoClient.vectorSearch(embedding, NUM_CANDIDATES, limit, selectedIds);

        // Extract relevant document IDs
        const relevantDocumentIds = searchResults.map(doc => doc._id.toString());

        // Fetch full documents for the relevant IDs
        const searchResultDocuments = await mongoClient.getConversationsByIds(relevantDocumentIds);

        // Fetch all documents by selected IDs
        const selectedDocuments = await mongoClient.getConversationsByIds(selectedIds);

        // Remove searchResult document ids from selectedDocuments
        const filteredSelectedDocuments = selectedDocuments.filter(doc => 
            !relevantDocumentIds.includes(doc._id.toString())
        );

        // Combine searchResultDocuments and filteredSelectedDocuments
        let allDocuments = [...searchResultDocuments, ...filteredSelectedDocuments];

        // Downsample if necessary
        allDocuments = downsampleDocuments(allDocuments, searchResultDocuments.length, MAX_BATCH_SIZE);

        // Generate answer based on relevant documents
        const answer = await answerQuestion(question, allDocuments, searchResultDocuments.length);

        return new Response(JSON.stringify({
            question,
            answer,
            relevantDocumentsCount: allDocuments.length,
            relevantDocumentIds
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error('Error in GET request:', error);
        let errorMessage = 'An unexpected error occurred.';
        let statusCode = 500;

        if (error instanceof OpenAI.APIError && error.status === 429) {
            errorMessage = 'OpenAI API rate limit exceeded. Please try again later.';
            statusCode = 429;
        }

        return new Response(JSON.stringify({ error: errorMessage }), {
            status: statusCode,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

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

/**
 * Downsamples the documents to fit within the maximum batch size.
 * @param documents - The documents to downsample.
 * @param searchResultCount - The first N documents are highly relevant.
 * @param maxBatchSize - The maximum batch size.
 * @returns 
 */
function downsampleDocuments(
    documents: ConversationDocument[], 
    searchResultCount: number, 
    maxBatchSize: number
): ConversationDocument[] {
    let totalTokens = estimateTotalTokens(documents);
    const selectedDocuments = documents.slice(0, searchResultCount);
    let remainingDocuments = documents.slice(searchResultCount);

    while (totalTokens > maxBatchSize && remainingDocuments.length > 0) {
        remainingDocuments = remainingDocuments.filter((_, index) => index % 2 === 0);
        const newDocuments = [...selectedDocuments, ...remainingDocuments];
        totalTokens = estimateTotalTokens(newDocuments);
        if (totalTokens <= maxBatchSize) {
            return newDocuments;
        }
    }

    return selectedDocuments;
}

function estimateTotalTokens(documents: ConversationDocument[]): number {
    return documents.reduce((total, doc) => 
        total + estimateTokens(doc.conversation.map(message => `${message.role}: ${message.content}`).join(' ')),
        0
    );
}

async function answerQuestion(
    question: string, 
    documents: ConversationDocument[], 
    searchResultCount: number
): Promise<string> {
    const openai = new OpenAI();
    const searchResultBlob = documents.slice(0, searchResultCount)
        .map((doc) => doc.conversation.map((message) => `${message.role}: ${message.content}`).join('\n'))
        .join('\n\n--- NEXT HIGHLY RELEVANT CONVERSATION ---\n\n');
    
    const otherDocumentsBlob = documents.slice(searchResultCount)
        .map((doc) => doc.conversation.map((message) => `${message.role}: ${message.content}`).join('\n'))
        .join('\n\n--- NEXT CONVERSATION ---\n\n');

    const prompt = `
You are an extremely clever and succinct assistant that answers questions based on the provided conversations.
All "documents" refer to conversations between a user and an AI assistant.
Use the information from the conversations to answer the question as accurately and helpfully as possible.
You must answer the question or obey the request truthfully and accurately using ONLY information from the conversations provided as insight. If the answer is not in the conversations, say so.

SPECIAL EMPHASIS: The first ${searchResultCount} conversations are highly relevant to the question. Pay extra attention to these conversations when formulating your answer.

You MUST answer the question, and provide no other information.

Question: ${question}

Highly Relevant Conversations:
${searchResultBlob}

Other Conversations:
${otherDocumentsBlob}

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
