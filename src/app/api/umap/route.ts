export const dynamic = 'force-dynamic'; // static by default, unless reading the request
import { MongoDBClient } from '../mongoclient';
import { PromisePool } from '../promisepool';
import { UMAP } from 'umap-js';
/**
 * Endpoint
 */
export async function POST() {
    const mongoClient = MongoDBClient.getInstance();
    const conversations = await mongoClient.getConversations()

    // Hypothetically the beauty of the UMAP model over t-SNE is that you can save its state
    // and use it to project new data later. I don't see a convenient way to do this in js for this demo
    // so I'll just save the embeddings and move on
    const umap = new UMAP({
        nComponents: 2,
        nNeighbors: 15,
        minDist: 0.1,
    });
    const embeddings = conversations.filter((conversation) => conversation.embedding).map((conversation) => conversation.embedding as number[]);
    const reducedEmbeddings = umap.fit(embeddings);


    console.log(umap.getEmbedding());
    console.log(reducedEmbeddings);

    // save the coordinates to the database, use a promise pool to do this in parallel
    const pool = new PromisePool(20);
    for (let i = 0; i < conversations.length; i++) {
        pool.add(async () => {
            await mongoClient.saveDocument({ ...conversations[i], coordinates: reducedEmbeddings[i] });
        });
    }
}
