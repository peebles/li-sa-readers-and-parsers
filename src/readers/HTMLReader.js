import { Document, FileReader } from "../schema/index.js";
/**
 * Extract the significant text from an arbitrary HTML document.
 * The contents of any head, script, style, and xml tags are removed completely.
 * The URLs for a[href] tags are extracted, along with the inner text of the tag.
 * All other tags are removed, and the inner text is kept intact.
 * Html entities (e.g., &amp;) are not decoded.
 */ export class HTMLReader extends FileReader {
    /**
   * Public method for this reader.
   * Required by BaseReader interface.
   * @param file Path/name of the file to be loaded.
   * @returns Promise<Document[]> A Promise object, eventually yielding zero or one Document parsed from the HTML content of the specified file.
   */ async loadDataAsContent(fileContent) {
        const decoder = new TextDecoder("utf-8");
        const dataBuffer = decoder.decode(fileContent);
        const htmlOptions = this.getOptions();
        const content = await this.parseContent(dataBuffer, htmlOptions);
        return [
            new Document({
                text: content
            })
        ];
    }
    /**
   * Wrapper for string-strip-html usage.
   * @param html Raw HTML content to be parsed.
   * @param options An object of options for the underlying library
   * @see getOptions
   * @returns The HTML content, stripped of unwanted tags and attributes
   */ async parseContent(html, options = {}) {
        const { stripHtml } = await import("string-strip-html"); // ESM only
        return stripHtml(html).result;
    }
    /**
   * Wrapper for our configuration options passed to string-strip-html library
   * @see https://codsen.com/os/string-strip-html/examples
   * @returns An object of options for the underlying library
   */ getOptions() {
        return {
            skipHtmlDecoding: true,
            stripTogetherWithTheirContents: [
                "script",
                "style",
                "xml",
                "head"
            ]
        };
    }
}
