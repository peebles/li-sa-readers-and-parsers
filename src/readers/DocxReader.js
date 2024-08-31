import { Document, FileReader } from "../schema/index.js";
export class DocxReader extends FileReader {
    /** DocxParser */ async loadDataAsContent(fileContent) {
        // Note: await mammoth.extractRawText({ arrayBuffer: fileContent });  is not working
        // So we need to convert to Buffer first
        const mammoth = await import("mammoth");
        const buffer = Buffer.from(fileContent);
        const { value } = await mammoth.extractRawText({
            buffer
        });
        return [
            new Document({
                text: value
            })
        ];
    }
}
