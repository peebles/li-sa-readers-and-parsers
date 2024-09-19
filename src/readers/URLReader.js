import { HTMLReader } from "./HTMLReader.js";

export class URLReader {
    async loadData(url) {
        const response = await fetch(url);
        const data = await response.arrayBuffer();
        const htmlReader = new HTMLReader();
        return htmlReader.loadDataAsContent(data);
    }
}
