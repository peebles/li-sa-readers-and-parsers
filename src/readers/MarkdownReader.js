import { Document, FileReader } from "../schema/index.js";
/**
 * Extract text from markdown files.
 * Returns dictionary with keys as headers and values as the text between headers.
 */ export class MarkdownReader extends FileReader {
    _removeHyperlinks;
    _removeImages;
    /**
   * @param {boolean} [removeHyperlinks=true] - Indicates whether hyperlinks should be removed.
   * @param {boolean} [removeImages=true] - Indicates whether images should be removed.
   */ constructor(removeHyperlinks = true, removeImages = true){
        super();
        this._removeHyperlinks = removeHyperlinks;
        this._removeImages = removeImages;
    }
    /**
   * Convert a markdown file to a dictionary.
   * The keys are the headers and the values are the text under each header.
   * @param {string} markdownText - The markdown text to convert.
   * @returns {Array<MarkdownTuple>} - An array of tuples, where each tuple contains a header (or null) and its corresponding text.
   */ markdownToTups(markdownText) {
        const markdownTups = [];
        const lines = markdownText.split("\n");
        let currentHeader = null;
        let currentText = "";
        for (const line of lines){
            const headerMatch = line.match(/^#+\s/);
            if (headerMatch) {
                if (currentHeader) {
                    if (!currentText) {
                        currentHeader += line + "\n";
                        continue;
                    }
                    markdownTups.push([
                        currentHeader,
                        currentText
                    ]);
                } else if (currentText) {
                    markdownTups.push([
                        null,
                        currentText
                    ]);
                }
                currentHeader = line;
                currentText = "";
            } else {
                currentText += line + "\n";
            }
        }
        markdownTups.push([
            currentHeader,
            currentText
        ]);
        if (currentHeader) {
            // pass linting, assert keys are defined
            markdownTups.map((tuple)=>[
                    tuple[0]?.replace(/#/g, "").trim() || null,
                    tuple[1].replace(/<.*?>/g, "")
                ]);
        } else {
            markdownTups.map((tuple)=>[
                    tuple[0],
                    tuple[1].replace(/<.*?>/g, "")
                ]);
        }
        return markdownTups;
    }
    removeImages(content) {
        const pattern = /!{1}\[\[(.*)\]\]/g;
        return content.replace(pattern, "");
    }
    removeHyperlinks(content) {
        const pattern = /\[(.*?)\]\((.*?)\)/g;
        return content.replace(pattern, "$1");
    }
    parseTups(content) {
        let modifiedContent = content;
        if (this._removeHyperlinks) {
            modifiedContent = this.removeHyperlinks(modifiedContent);
        }
        if (this._removeImages) {
            modifiedContent = this.removeImages(modifiedContent);
        }
        return this.markdownToTups(modifiedContent);
    }
    async loadDataAsContent(fileContent) {
        const decoder = new TextDecoder("utf-8");
        const content = decoder.decode(fileContent);
        const tups = this.parseTups(content);
        const results = [];
        let counter = 0;
        for (const [header, value] of tups){
            if (header) {
                const text = `\n\n${header}\n${value}`;
                results.push(new Document({
                    text
                }));
            } else {
                results.push(new Document({
                    text: value
                }));
            }
            counter += 1;
        }
        return results;
    }
}
