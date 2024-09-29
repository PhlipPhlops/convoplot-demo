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
        // Generate keywords for the question
        const keywords = await generateKeywords(question);

        // Generate embedding for the keywords
        const embedding = await getEmbedding(keywords.join(' '));

        // Perform vector search without filtering by selectedIds
        const searchResults = await mongoClient.vectorSearch(embedding, NUM_CANDIDATES, limit);

        // Extract relevant document IDs from search results
        const relevantDocumentIds = searchResults.map(doc => doc._id.toString());

        // Fetch full documents for the relevant IDs
        const searchResultDocuments = await mongoClient.getConversationsByIds(relevantDocumentIds);

        // Fetch all documents by selected IDs
        const selectedDocuments = await mongoClient.getConversationsByIds(selectedIds);

        // Categorize documents
        const highlyRelevantDocs = searchResultDocuments.filter(doc => selectedIds.includes(doc._id.toString()));
        const relevantUnselectedDocs = searchResultDocuments.filter(doc => !selectedIds.includes(doc._id.toString()));
        const selectedUnrelevantDocs = selectedDocuments.filter(doc => !relevantDocumentIds.includes(doc._id.toString()));

        // Combine all documents
        let allDocuments = [...highlyRelevantDocs, ...relevantUnselectedDocs, ...selectedUnrelevantDocs];

        // Downsample if necessary, preserving highly relevant documents
        allDocuments = downsampleDocuments(allDocuments, highlyRelevantDocs.length, MAX_BATCH_SIZE);

        // Generate answer based on all documents
        const answer = await answerQuestion(question, allDocuments, highlyRelevantDocs.length, relevantUnselectedDocs.length);

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

async function generateKeywords(question: string): Promise<string[]> {
    const openai = new OpenAI();
    const prompt = `
Generate a list of 1-5 highly relevant topic-keywords for the following question. 
Provide only the keywords, separated by commas, without any additional text or explanation.

Question: ${question}

Keywords:`;

    const response = await openai.chat.completions.create({
        model: GPT_4o_MINI,
        messages: [
            { role: "user", content: prompt },
        ],
        max_tokens: 50,
        temperature: 0.5,
    });

    const keywordsString = response.choices[0].message.content?.trim() || "";
    return keywordsString.split(',').map(keyword => keyword.trim());
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

function downsampleDocuments(
    documents: ConversationDocument[], 
    highlyRelevantCount: number,
    maxBatchSize: number
): ConversationDocument[] {
    let totalTokens = estimateTotalTokens(documents);
    const highlyRelevantDocs = documents.slice(0, highlyRelevantCount);
    let remainingDocuments = documents.slice(highlyRelevantCount);

    while (totalTokens > maxBatchSize && remainingDocuments.length > 0) {
        remainingDocuments = remainingDocuments.filter((_, index) => index % 2 === 0);
        const newDocuments = [...highlyRelevantDocs, ...remainingDocuments];
        totalTokens = estimateTotalTokens(newDocuments);
        if (totalTokens <= maxBatchSize) {
            return newDocuments;
        }
    }

    return highlyRelevantDocs;
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
    highlyRelevantCount: number,
    relevantUnselectedCount: number
): Promise<string> {
    const openai = new OpenAI();
    const highlyRelevantBlob = documents.slice(0, highlyRelevantCount)
        .map((doc) => doc.conversation.map((message) => `${message.role}: ${message.content}`).join('\n'))
        .join('\n\n--- NEXT HIGHLY RELEVANT CONVERSATION ---\n\n');
    
    const relevantUnselectedBlob = documents.slice(highlyRelevantCount, highlyRelevantCount + relevantUnselectedCount)
        .map((doc) => doc.conversation.map((message) => `${message.role}: ${message.content}`).join('\n'))
        .join('\n\n--- NEXT RELEVANT UNSELECTED CONVERSATION ---\n\n');
    
    const otherDocumentsBlob = documents.slice(highlyRelevantCount + relevantUnselectedCount)
        .map((doc) => doc.conversation.map((message) => `${message.role}: ${message.content}`).join('\n'))
        .join('\n\n--- NEXT CONVERSATION ---\n\n');

    const prompt = `
You are an extremely clever and succinct assistant that answers questions based on the provided conversations.
All "documents" refer to conversations between a user and an AI assistant.
Use the information from the conversations to answer the question as accurately and helpfully as possible.
You must answer the question or obey the request truthfully and accurately using ONLY information from the conversations provided as insight. If the answer is not in the conversations, say so.

SPECIAL EMPHASIS: 
1. The first ${highlyRelevantCount} conversations are highly relevant to the question and were selected by the user. Pay extra attention to these conversations when formulating your answer.
2. The next ${relevantUnselectedCount} conversations are relevant to the question but were not selected by the user. Consider this information as potentially useful context. Let the user know that these conversations were found outside of their selected ids.
3. The remaining conversations were selected by the user but may not be directly relevant to the question. Use them for additional context if needed.

You MUST answer the question, and provide no other information.

Question: ${question}

Highly Relevant Selected Conversations:
${highlyRelevantBlob}

Relevant Unselected Conversations:
${relevantUnselectedBlob}

Other Selected Conversations:
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