import { Document } from "../schema/index.js";
/**
 * Notion pages are retrieved recursively and converted to Document objects.
 * Notion Database can also be loaded, and [the serialization method can be customized](https://github.com/TomPenguin/notion-md-crawler/tree/main).
 *
 * [Note] To use this reader, must be created the Notion integration must be created in advance
 * Please refer to [this document](https://www.notion.so/help/create-integrations-with-the-notion-api) for details.
 */ export class NotionReader {
    crawl;
    /**
   * Constructor for the NotionReader class
   * @param {NotionReaderOptions} options - Configuration options for the reader
   */ constructor({ client, serializers }){
        this.client = client;
        this.serializers = serializers;
    }
    async getCrawler() {
        const { crawler } = await import("notion-md-crawler");
        return crawler({
            client: this.client,
            serializers: this.serializers
        });
    }
    /**
   * Converts Pages to an array of Document objects
   * @param {Page} pages - The Notion pages to convert (Return value of `loadPages`)
   * @returns {Document[]} An array of Document objects
   */ async toDocuments(pages) {
        const { pageToString } = await import("notion-md-crawler");
        return Object.values(pages).map((page)=>{
            const text = pageToString(page);
            return new Document({
                id_: page.metadata.id,
                text,
                metadata: page.metadata
            });
        });
    }
    /**
   * Loads recursively the Notion page with the specified root page ID.
   * @param {string} rootPageId - The root Notion page ID
   * @returns {Promise<Page[]>} A Promise that resolves to a Pages object(Convertible with the `toDocuments` method)
   */ async loadPages(rootPageId) {
        const crawl = await this.getCrawler();
        const iter = crawl(rootPageId);
        const pages = [];
        for await (const result of iter){
            if (result.success) {
                pages.push(result.page);
            } else {
                console.error(`Failed to load page (${result.failure.parentId}): ${result.failure.reason}`);
            }
        }
        return pages;
    }
    /**
   * Loads recursively Notion pages and converts them to an array of Document objects
   * @param {string} rootPageId - The root Notion page ID
   * @returns {Promise<Document[]>} A Promise that resolves to an array of Document objects
   */ async loadData(rootPageId) {
        const pages = await this.loadPages(rootPageId);
        return await this.toDocuments(pages);
    }
}
