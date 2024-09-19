import { Document } from "../schema/index.js";

const DefaultOptions = {
    limit: 1,
    store_data: false,
    metadata: false,
    request: "http",
    return_format: "markdown",
};

export class SpiderCloudReader {
    constructor(options = {}) {
        this.options = { ...DefaultOptions, ...options };
    }
    async loadData(url) {
        const {Spider} = await import("@spider-cloud/spider-client");
        const app = new Spider({ 
            apiKey: process.env.SPIDER_API_KEY,
        });
        const res = await app.crawlUrl(url, this.options);
        if (res.length === 1 && res[0].status !== 200) {
            throw new Error(`Failed to crawl ${url}: status=${res[0].status}`);
        }
        return res.map(block => new Document({
            text: block.content,
        }));
    }
}
