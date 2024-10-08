import { Document, FileReader } from "../schema/index.js";
/**
 * Read a .txt file
 */ export class TextFileReader extends FileReader {
    async loadDataAsContent(fileContent) {
        const decoder = new TextDecoder("utf-8");
        const dataBuffer = decoder.decode(fileContent);
        return [
            new Document({
                text: dataBuffer
            })
        ];
    }
}
