export const dynamic = 'force-dynamic'; // static by default, unless reading the request
import { MongoDBClient } from '../mongoclient';
/**
 * Endpoint
 */
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const dataType = searchParams.get('dataType');
    const limit = Number(searchParams.get('limit')) || undefined;
    const ids = searchParams.get('ids')?.split(',') || [];

    let data;
    if (dataType === 'coords') {
        data = await getCoords(limit);
    } else if (dataType === 'full') {
        data = await getDocs(limit);
    } else if (dataType === 'ids') {
        data = await getDocsByIds(ids);
    } else {
        return new Response('Invalid route parameter', { status: 400 });
    }

    return new Response(JSON.stringify(data), {
        status: 200,
        headers: {
            'Content-Type': 'application/json'
        }
    });
}

async function getCoords(limit?: number) {
    const mongoClient = MongoDBClient.getInstance();
    const data = await mongoClient.getCoords(limit);
    return data
}

async function getDocs(limit?: number) {
    const mongoClient = MongoDBClient.getInstance();
    const data = await mongoClient.getConversations(limit);
    return data.map(conv => ({
        id: conv.conversation_id,
        model: conv.model,
        language: conv.language,
        turn: conv.turn,
        redacted: conv.redacted
    }));
}

async function getDocsByIds(ids: string[]) {
    const mongoClient = MongoDBClient.getInstance();
    const data = await mongoClient.getConversationsByIds(ids);
    return data;
}