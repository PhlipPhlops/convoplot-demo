import { MongoClient, Db, ObjectId } from 'mongodb';
import { ConversationDocument } from './types';

export class MongoDBClient {
    private static instance: MongoDBClient;
    private client: MongoClient;
    private db: Db | null = null;
  
    private constructor() {
      const uri = process.env.MONGODB_URI as string;
      if (!uri) {
          throw new Error('Please add your MongoDB URI to .env.local');
        }
        this.client = new MongoClient(uri);
    }
  
    public static getInstance(): MongoDBClient {
      if (!MongoDBClient.instance) {
        MongoDBClient.instance = new MongoDBClient();
      }
      return MongoDBClient.instance;
    }
  
    public async connect(): Promise<void> {
      if (!this.db) {
        try {
          await this.client.connect();
          this.db = this.client.db('slingshot-demo');
          console.log('Connected to MongoDB');
        } catch (error) {
          console.error('Error connecting to MongoDB:', error);
          throw error;
        }
      }
    }


    public async saveDocument(document: ConversationDocument): Promise<void> {
        if (!this.db) {
            await this.connect();
        }
        const conversationsCollection = this.db!.collection('conversations');
        await conversationsCollection.updateOne({ _id: document._id }, { $set: document }, { upsert: true });
    }
  
    public async getConversations(limit?: number): Promise<ConversationDocument[]> {
      if (!this.db) {
        await this.connect();
      }
      const conversationsCollection = this.db!.collection('conversations');
      if (limit) {
          return await conversationsCollection.find({}).limit(limit).toArray() as unknown as ConversationDocument[];
      } else {
          return await conversationsCollection.find({}).toArray() as unknown as ConversationDocument[];
      }
    }

    public async getCoords(limit?: number): Promise<ConversationDocument[]> {
        if (!this.db) {
            await this.connect();
        }
        const conversationsCollection = this.db!.collection('conversations');
        const projection = { coordinates: 1, _id: 1, summary: 1 };
        const query = { coordinates: { $ne: null } };
        if (limit) {
            return await conversationsCollection.find(query, { projection }).limit(limit).toArray() as unknown as ConversationDocument[];
        } else {
            return await conversationsCollection.find(query, { projection }).toArray() as unknown as ConversationDocument[];
        }
    }

    public async getConversationsByIds(ids: string[]): Promise<ConversationDocument[]> {
        if (!this.db) {
            await this.connect();
        }
        const objectIds = ids.filter(id => ObjectId.isValid(id)).map((id) => new ObjectId(id));
        if (objectIds.length === 0) {
            console.warn('No valid ObjectIds were provided');
            return [];
        }
        const projection = { coordinates: 1, _id: 1, conversation: 1, model:1, summary: 1 };
        const conversationsCollection = this.db!.collection('conversations');
        return await conversationsCollection.find({ _id: { $in: objectIds } }, { projection }).toArray() as unknown as ConversationDocument[];
    }

    async updateConversationSummary(docId: ObjectId, summary: string): Promise<{ _id: ObjectId, wasUpdated: boolean }> {
        if (!this.db) {
            await this.connect();
        }
        const collection = this.db!.collection<ConversationDocument>('conversations');
        try {
            const result = await collection.updateOne(
                { _id: docId },
                { $set: { summary: summary } }
            );
            return { _id: docId, wasUpdated: result.modifiedCount > 0 };
        } catch (error) {
            console.error(`Error updating document ${docId}:`, error);
            return { _id: docId, wasUpdated: false };
        }
    }

    async saveQuestionVote(question: string, vote: 'good' | 'poor') {
        if (!this.db) {
            await this.connect();
        }
        const collection = this.db!.collection('votedQuestions');
        await collection.updateOne(
            { question },
            { $set: { vote } },
            { upsert: true }
        );
    }

    async getVotedQuestions() {
        if (!this.db) {
            await this.connect();
        }
        const collection = this.db!.collection('votedQuestions');
        return await collection.find().toArray();
    }

    async deleteQuestionVote(question: string) {
        if (!this.db) {
            await this.connect();
        }
        const collection = this.db!.collection('votedQuestions');
        await collection.deleteOne({ question });
    }

    async vectorSearch(queryVector: number[], numCandidates: number, limit: number, selectedIDs?: string[]) {
        if (!this.db) {
            await this.connect();
        }
        if (limit > numCandidates) {
            limit = numCandidates;
        }
        
        const conversationsCollection = this.db!.collection('conversations');
        let pipeline: any[] = [];

        // Vector search stage (always first)
        pipeline.push({
            "$vectorSearch": {
                "index": "vector_index",
                "path": "embedding",
                "queryVector": queryVector,
                "numCandidates": numCandidates,
                "limit": limit
            }
        });

        // Filter by selectedIDs if provided
        if (selectedIDs && selectedIDs.length > 0) {
            const objectIds = selectedIDs.filter(id => ObjectId.isValid(id)).map(id => new ObjectId(id));
            pipeline.push({ $match: { _id: { $in: objectIds } } });
        }

        // Apply limit
        pipeline.push({ $limit: limit });

        // Project stage
        pipeline.push({
            "$project": {
                "_id": 1,
                "coordinates": 1,
                "summary": 1
            }
        });

        return await conversationsCollection.aggregate(pipeline).toArray();
    }
}