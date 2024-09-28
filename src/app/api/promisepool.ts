// I like to use promise pools when I'm doing async tasks across tons of documents
// It's like concurrent batching, but instead of waiting for the entire batch to finish before starting the next,
// you pull in items from the queue as soon as one finishes.

export class PromisePool {
    private concurrency: number;
    private running: number;
    private queue: (() => Promise<void>)[];

    constructor(concurrency: number) {
        this.concurrency = concurrency;
        this.running = 0;
        this.queue = [];
    }

    async add<T>(task: () => Promise<T>): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            this.queue.push(async () => {
                try {
                    const result = await task();
                    resolve(result);
                } catch (error) {
                    reject(error);
                } finally {
                    this.running--;
                    this.run();
                }
            });
            this.run();
        });
    }

    private run(): void {
        while (this.running < this.concurrency && this.queue.length > 0) {
            const task = this.queue.shift();
            if (task) {
                this.running++;
                task();
            }
        }
    }
}