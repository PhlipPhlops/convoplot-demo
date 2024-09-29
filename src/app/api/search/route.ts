import { NextResponse } from 'next/server';
import { MongoDBClient } from '../mongoclient';

export async function POST(request: Request) {
    try {
        const { queryVector, numCandidates = 100, limit = 100 } = await request.json();

        if (!Array.isArray(queryVector) || queryVector.length === 0) {
            return NextResponse.json({ error: 'Invalid query vector' }, { status: 400 });
        }

        const mongoClient = MongoDBClient.getInstance();
        await mongoClient.connect();

        const result = await mongoClient.vectorSearch(queryVector, numCandidates, limit);

        return NextResponse.json(result);
    } catch (error) {
        console.error('Error in search route:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}