import path from "path";
import { PapaCSVReader } from "./CSVReader.js";
import { DocxReader } from "./DocxReader.js";
import { HTMLReader } from "./HTMLReader.js";
import { ImageReader } from "./ImageReader.js";
import { MarkdownReader } from "./MarkdownReader.js";
import { PDFReader } from "./PDFReader.js";
import { TextFileReader } from "./TextFileReader.js";
import { JSONReader } from "./JSONReader.js";

export const FILE_EXT_TO_READER = {
    json: new JSONReader(),
    txt: new TextFileReader(),
    pdf: new PDFReader(),
    csv: new PapaCSVReader(),
    md: new MarkdownReader(),
    docx: new DocxReader(),
    htm: new HTMLReader(),
    html: new HTMLReader(),
    jpg: new ImageReader(),
    jpeg: new ImageReader(),
    png: new ImageReader(),
    gif: new ImageReader()
};
export class SimpleFileReader {
    async loadData(filename) {
        const ext = path.extname(filename).toLowerCase();
        const reader = FILE_EXT_TO_READER[ext.slice(1)];
        if (!reader) {
            throw new Error(`Unsupported file type: ${ext} for file: ${filename}`);
        }
        return reader.loadData(filename);
    }
}
