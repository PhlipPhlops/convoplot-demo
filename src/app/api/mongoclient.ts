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
        const projection = { coordinates: 1, _id: 1 };
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
        const objectIds = ids.map((id) => new ObjectId(id));
        const projection = { coordinates: 1, _id: 1, conversation: 1, model:1 };
        const conversationsCollection = this.db!.collection('conversations');
        return await conversationsCollection.find({ _id: { $in: objectIds } }, { projection }).toArray() as unknown as ConversationDocument[];
    }
  }