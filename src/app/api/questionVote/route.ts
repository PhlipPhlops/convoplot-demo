export const dynamic = 'force-dynamic';
import { MongoDBClient } from '../mongoclient';

export async function POST(request: Request) {
    const { question, vote, action } = await request.json();

    if (!question || (!vote && action !== 'delete')) {
        return new Response('Missing question or vote', { status: 400 });
    }

    const mongoClient = MongoDBClient.getInstance();

    if (action === 'delete') {
        await mongoClient.deleteQuestionVote(question);
    } else {
        await mongoClient.saveQuestionVote(question, vote);
    }

    return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: {
            'Content-Type': 'application/json'
        }
    });
}

export async function GET() {
    const mongoClient = MongoDBClient.getInstance();
    const questions = await mongoClient.getVotedQuestions();

    return new Response(JSON.stringify(questions), {
        status: 200,
        headers: {
            'Content-Type': 'application/json'
        }
    });
}