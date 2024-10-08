import { Document, FileReader } from "../schema/index.js";
/**
 * Read the text of a PDF
 */ export class PDFReader extends FileReader {
    async loadDataAsContent(content) {
        // XXX: create a new Uint8Array to prevent "Please provide binary data as `Uint8Array`, rather than `Buffer`." error if a Buffer passed
        if (content instanceof Buffer) {
            content = new Uint8Array(content);
        }
        const { totalPages, text } = await readPDF(content);
        return text.map((text, page)=>{
            const metadata = {
                page_number: page + 1,
                total_pages: totalPages
            };
            return new Document({
                text,
                metadata
            });
        });
    }
}
async function readPDF(data) {
    const { extractText } = await import("unpdf");
    return await extractText(data);
}
