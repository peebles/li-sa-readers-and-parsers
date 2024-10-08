import { Settings } from '../global/index.js';
import { TransformComponent, MetadataMode, NodeRelationship, buildNodeFromSplits, sentenceSplitterSchema, sentenceWindowNodeParserSchema } from '../schema/index.js';
import { randomUUID } from '../env/index.js';

class NodeParser extends TransformComponent {
    constructor(){
        super(async (nodes)=>{
            return this.getNodesFromDocuments(nodes);
        });
        this.includeMetadata = true;
        this.includePrevNextRel = true;
    }
    postProcessParsedNodes(nodes, parentDocMap) {
        nodes.forEach((node, i)=>{
            const parentDoc = parentDocMap.get(node.sourceNode?.nodeId || "");
            if (parentDoc) {
                const startCharIdx = parentDoc.text.indexOf(node.getContent(MetadataMode.NONE));
                if (startCharIdx >= 0) {
                    node.startCharIdx = startCharIdx;
                    node.endCharIdx = startCharIdx + node.getContent(MetadataMode.NONE).length;
                }
                if (this.includeMetadata && node.metadata && parentDoc.metadata) {
                    node.metadata = {
                        ...node.metadata,
                        ...parentDoc.metadata
                    };
                }
            }
            if (this.includePrevNextRel && node.sourceNode) {
                const previousNode = i > 0 ? nodes[i - 1] : null;
                const nextNode = i < nodes.length - 1 ? nodes[i + 1] : null;
                if (previousNode && previousNode.sourceNode && previousNode.sourceNode.nodeId === node.sourceNode.nodeId) {
                    node.relationships = {
                        ...node.relationships,
                        [NodeRelationship.PREVIOUS]: previousNode.asRelatedNodeInfo()
                    };
                }
                if (nextNode && nextNode.sourceNode && nextNode.sourceNode.nodeId === node.sourceNode.nodeId) {
                    node.relationships = {
                        ...node.relationships,
                        [NodeRelationship.NEXT]: nextNode.asRelatedNodeInfo()
                    };
                }
            }
        });
        return nodes;
    }
    getNodesFromDocuments(documents) {
        const docsId = new Map(documents.map((doc)=>[
                doc.id_,
                doc
            ]));
        const callbackManager = Settings.callbackManager;
        callbackManager.dispatchEvent("node-parsing-start", {
            documents
        });
        const nodes = this.postProcessParsedNodes(this.parseNodes(documents), docsId);
        callbackManager.dispatchEvent("node-parsing-end", {
            nodes
        });
        return nodes;
    }
}
class TextSplitter extends NodeParser {
    splitTexts(texts) {
        return texts.flatMap((text)=>this.splitText(text));
    }
    parseNodes(nodes) {
        return nodes.reduce((allNodes, node)=>{
            const splits = this.splitText(node.getContent(MetadataMode.ALL));
            const nodes = buildNodeFromSplits(splits, node);
            return allNodes.concat(nodes);
        }, []);
    }
}
class MetadataAwareTextSplitter extends TextSplitter {
    splitTextsMetadataAware(texts, metadata) {
        if (texts.length !== metadata.length) {
            throw new TypeError("`texts` and `metadata` must have the same length");
        }
        return texts.flatMap((text, i)=>this.splitTextMetadataAware(text, metadata[i]));
    }
    getMetadataString(node) {
        const embedStr = node.getMetadataStr(MetadataMode.EMBED);
        const llmStr = node.getMetadataStr(MetadataMode.LLM);
        if (embedStr.length > llmStr.length) {
            return embedStr;
        } else {
            return llmStr;
        }
    }
    parseNodes(nodes) {
        return nodes.reduce((allNodes, node)=>{
            const metadataStr = this.getMetadataString(node);
            const splits = this.splitTextMetadataAware(node.getContent(MetadataMode.NONE), metadataStr);
            return allNodes.concat(buildNodeFromSplits(splits, node));
        }, []);
    }
}

var __getOwnPropNames = Object.getOwnPropertyNames;
var __commonJS = (cb, mod)=>function __require() {
        return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = {
            exports: {}
        }).exports, mod), mod.exports;
    };
// lib/natural/tokenizers/tokenizer.js
var require_tokenizer = __commonJS({
    "lib/natural/tokenizers/tokenizer.js" (exports, module) {
        var Tokenizer = class {
            trim(array) {
                while(array[array.length - 1] === ""){
                    array.pop();
                }
                while(array[0] === ""){
                    array.shift();
                }
                return array;
            }
        };
        module.exports = Tokenizer;
    }
});
// lib/natural/tokenizers/sentence_tokenizer.js
var require_sentence_tokenizer = __commonJS({
    "lib/natural/tokenizers/sentence_tokenizer.js" (exports, module) {
        var Tokenizer = require_tokenizer();
        var NUM = "NUMBER";
        var DELIM = "DELIM";
        var URI = "URI";
        var ABBREV = "ABBREV";
        function generateUniqueCode(base, index) {
            return `{{${base}_${index}}}`;
        }
        function escapeRegExp(string) {
            return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        }
        var SentenceTokenizer = class extends Tokenizer {
            constructor(abbreviations){
                super();
                if (abbreviations) {
                    this.abbreviations = abbreviations;
                } else {
                    this.abbreviations = [];
                }
                this.replacementMap = null;
                this.replacementCounter = 0;
            }
            replaceUrisWithPlaceholders(text) {
                const urlPattern = /(https?:\/\/\S+|www\.\S+|ftp:\/\/\S+|(mailto:)?[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}|file:\/\/\S+)/gi;
                const modifiedText = text.replace(urlPattern, (match)=>{
                    const placeholder = generateUniqueCode(URI, this.replacementCounter++);
                    this.replacementMap.set(placeholder, match);
                    return placeholder;
                });
                return modifiedText;
            }
            replaceAbbreviations(text) {
                if (this.abbreviations.length === 0) {
                    return text;
                }
                const pattern = new RegExp(`(${this.abbreviations.map((abbrev)=>escapeRegExp(abbrev)).join("|")})`, "gi");
                const replacedText = text.replace(pattern, (match)=>{
                    const code = generateUniqueCode(ABBREV, this.replacementCounter++);
                    this.replacementMap.set(code, match);
                    return code;
                });
                return replacedText;
            }
            replaceDelimitersWithPlaceholders(text) {
                const delimiterPattern = /([.?!… ]*)([.?!…])(["'”’)}\]]?)/g;
                const modifiedText = text.replace(delimiterPattern, (match, p1, p2, p3)=>{
                    const placeholder = generateUniqueCode(DELIM, this.replacementCounter++);
                    this.delimiterMap.set(placeholder, p1 + p2 + p3);
                    return placeholder;
                });
                return modifiedText;
            }
            splitOnPlaceholders(text, placeholders) {
                if (this.delimiterMap.size === 0) {
                    return [
                        text
                    ];
                }
                const keys = Array.from(this.delimiterMap.keys());
                const pattern = new RegExp(`(${keys.map(escapeRegExp).join("|")})`);
                const parts = text.split(pattern);
                const sentences = [];
                for(let i = 0; i < parts.length; i += 2){
                    const sentence = parts[i];
                    const placeholder = parts[i + 1] || "";
                    sentences.push(sentence + placeholder);
                }
                return sentences;
            }
            replaceNumbersWithCode(text) {
                const numberPattern = /\b\d{1,3}(?:,\d{3})*(?:\.\d+)?\b/g;
                const replacedText = text.replace(numberPattern, (match)=>{
                    const code = generateUniqueCode(NUM, this.replacementCounter++);
                    this.replacementMap.set(code, match);
                    return code;
                });
                return replacedText;
            }
            revertReplacements(text) {
                let originalText = text;
                for (const [placeholder, replacement] of this.replacementMap.entries()){
                    const pattern = new RegExp(escapeRegExp(placeholder), "g");
                    originalText = originalText.replace(pattern, replacement);
                }
                return originalText;
            }
            revertDelimiters(text) {
                let originalText = text;
                for (const [placeholder, replacement] of this.delimiterMap.entries()){
                    const pattern = new RegExp(escapeRegExp(placeholder), "g");
                    originalText = originalText.replace(pattern, replacement);
                }
                return originalText;
            }
            tokenize(text) {
                this.replacementCounter = 0;
                this.replacementMap = /* @__PURE__ */ new Map();
                this.delimiterMap = /* @__PURE__ */ new Map();
                const result1 = this.replaceAbbreviations(text);
                const result2 = this.replaceUrisWithPlaceholders(result1);
                const result3 = this.replaceNumbersWithCode(result2);
                const result4 = this.replaceDelimitersWithPlaceholders(result3);
                const sentences = this.splitOnPlaceholders(result4);
                const newSentences = sentences.map((s)=>{
                    const s1 = this.revertReplacements(s);
                    return this.revertDelimiters(s1);
                });
                const trimmedSentences = this.trim(newSentences);
                const trimmedSentences2 = trimmedSentences.map((sent)=>sent.trim());
                return trimmedSentences2;
            }
        };
        module.exports = SentenceTokenizer;
    }
});
var SentenceTokenizer = require_sentence_tokenizer();

const splitTextKeepSeparator = (text, separator)=>{
    const parts = text.split(separator);
    const result = parts.map((part, index)=>index > 0 ? separator + part : part);
    return result.filter((s)=>s);
};
const splitBySep = (sep, keepSep = true)=>{
    if (keepSep) {
        return (text)=>splitTextKeepSeparator(text, sep);
    } else {
        return (text)=>text.split(sep);
    }
};
const splitByChar = ()=>{
    return (text)=>text.split("");
};
let sentenceTokenizer = null;
const splitBySentenceTokenizer = ()=>{
    if (!sentenceTokenizer) {
        sentenceTokenizer = new SentenceTokenizer([
            "i.e.",
            "etc.",
            "vs.",
            "Inc.",
            "A.S.A.P."
        ]);
    }
    const tokenizer = sentenceTokenizer;
    return (text)=>{
        try {
            return tokenizer.tokenize(text);
        } catch  {
            return [
                text
            ];
        }
    };
};
const splitByRegex = (regex)=>{
    return (text)=>text.match(new RegExp(regex, "g")) || [];
};
const splitByPhraseRegex = ()=>{
    const regex = "[^,.;]+[,.;]?";
    return splitByRegex(regex);
};

/**
 * Parse text with a preference for complete sentences.
 */ class SentenceSplitter extends MetadataAwareTextSplitter {
    #chunkingTokenizerFn;
    #splitFns;
    #subSentenceSplitFns;
    #tokenizer;
    constructor(params){
        super();
        /**
   * The token chunk size for each chunk.
   */ this.chunkSize = 1024;
        /**
   * The token overlap of each chunk when splitting.
   */ this.chunkOverlap = 200;
        /**
   * Default separator for splitting into words
   */ this.separator = " ";
        /**
   * Separator between paragraphs.
   */ this.paragraphSeparator = "\n\n\n";
        /**
   * Backup regex for splitting into sentences.
   */ this.secondaryChunkingRegex = "[^,.;。？！]+[,.;。？！]?";
        this.#chunkingTokenizerFn = splitBySentenceTokenizer();
        this.#splitFns = new Set();
        this.#subSentenceSplitFns = new Set();
        this.tokenSize = (text)=>this.#tokenizer.encode(text).length;
        if (params) {
            const parsedParams = sentenceSplitterSchema.parse(params);
            this.chunkSize = parsedParams.chunkSize;
            this.chunkOverlap = parsedParams.chunkOverlap;
            this.separator = parsedParams.separator;
            this.paragraphSeparator = parsedParams.paragraphSeparator;
            this.secondaryChunkingRegex = parsedParams.secondaryChunkingRegex;
        }
        this.#tokenizer = params?.tokenizer ?? Settings.tokenizer;
        this.#splitFns.add(splitBySep(this.paragraphSeparator));
        this.#splitFns.add(this.#chunkingTokenizerFn);
        this.#subSentenceSplitFns.add(splitByRegex(this.secondaryChunkingRegex));
        this.#subSentenceSplitFns.add(splitBySep(this.separator));
        this.#subSentenceSplitFns.add(splitByChar());
    }
    splitTextMetadataAware(text, metadata) {
        const metadataLength = this.tokenSize(metadata);
        const effectiveChunkSize = this.chunkSize - metadataLength;
        if (effectiveChunkSize <= 0) {
            throw new Error(`Metadata length (${metadataLength}) is longer than chunk size (${this.chunkSize}). Consider increasing the chunk size or decreasing the size of your metadata to avoid this.`);
        } else if (effectiveChunkSize < 50) {
            console.log(`Metadata length (${metadataLength}) is close to chunk size (${this.chunkSize}). Resulting chunks are less than 50 tokens. Consider increasing the chunk size or decreasing the size of your metadata to avoid this.`);
        }
        return this._splitText(text, effectiveChunkSize);
    }
    splitText(text) {
        return this._splitText(text, this.chunkSize);
    }
    _splitText(text, chunkSize) {
        if (text === "") return [
            text
        ];
        const callbackManager = Settings.callbackManager;
        callbackManager.dispatchEvent("chunking-start", {
            text: [
                text
            ]
        });
        const splits = this.#split(text, chunkSize);
        const chunks = this.#merge(splits, chunkSize);
        callbackManager.dispatchEvent("chunking-end", {
            chunks
        });
        return chunks;
    }
    #split(text, chunkSize) {
        const tokenSize = this.tokenSize(text);
        if (tokenSize <= chunkSize) {
            return [
                {
                    text,
                    isSentence: true,
                    tokenSize
                }
            ];
        }
        const [textSplitsByFns, isSentence] = this.#getSplitsByFns(text);
        const textSplits = [];
        for (const textSplit of textSplitsByFns){
            const tokenSize = this.tokenSize(textSplit);
            if (tokenSize <= chunkSize) {
                textSplits.push({
                    text: textSplit,
                    isSentence,
                    tokenSize
                });
            } else {
                const recursiveTextSplits = this.#split(textSplit, chunkSize);
                textSplits.push(...recursiveTextSplits);
            }
        }
        return textSplits;
    }
    #getSplitsByFns(text) {
        for (const splitFn of this.#splitFns){
            const splits = splitFn(text);
            if (splits.length > 1) {
                return [
                    splits,
                    true
                ];
            }
        }
        for (const splitFn of this.#subSentenceSplitFns){
            const splits = splitFn(text);
            if (splits.length > 1) {
                return [
                    splits,
                    false
                ];
            }
        }
        return [
            [
                text
            ],
            true
        ];
    }
    #merge(splits, chunkSize) {
        const chunks = [];
        let currentChunk = [];
        let lastChunk = [];
        let currentChunkLength = 0;
        let newChunk = true;
        const closeChunk = ()=>{
            chunks.push(currentChunk.map(([text])=>text).join(""));
            lastChunk = currentChunk;
            currentChunk = [];
            currentChunkLength = 0;
            newChunk = true;
            let lastIndex = lastChunk.length - 1;
            while(lastIndex >= 0 && currentChunkLength + lastChunk[lastIndex][1] <= this.chunkOverlap){
                const [text, length] = lastChunk[lastIndex];
                currentChunkLength += length;
                currentChunk.unshift([
                    text,
                    length
                ]);
                lastIndex -= 1;
            }
        };
        while(splits.length > 0){
            const curSplit = splits[0];
            if (curSplit.tokenSize > chunkSize) {
                throw new Error("Single token exceeded chunk size");
            }
            if (currentChunkLength + curSplit.tokenSize > chunkSize && !newChunk) {
                closeChunk();
            } else {
                if (curSplit.isSentence || currentChunkLength + curSplit.tokenSize <= chunkSize || newChunk) {
                    currentChunkLength += curSplit.tokenSize;
                    currentChunk.push([
                        curSplit.text,
                        curSplit.tokenSize
                    ]);
                    splits.shift();
                    newChunk = false;
                } else {
                    closeChunk();
                }
            }
        }
        // Handle the last chunk
        if (!newChunk) {
            chunks.push(currentChunk.map(([text])=>text).join(""));
        }
        return this.#postprocessChunks(chunks);
    }
    /**
   * Remove whitespace only chunks and remove leading and trailing whitespace.
   */ #postprocessChunks(chunks) {
        const newChunks = [];
        for (const chunk of chunks){
            const trimmedChunk = chunk.trim();
            if (trimmedChunk !== "") {
                newChunks.push(trimmedChunk);
            }
        }
        return newChunks;
    }
}

class MarkdownNodeParser extends NodeParser {
    parseNodes(nodes, showProgress) {
        return nodes.reduce((allNodes, node)=>{
            const markdownNodes = this.getNodesFromNode(node);
            return allNodes.concat(markdownNodes);
        }, []);
    }
    getNodesFromNode(node) {
        const text = node.getContent(MetadataMode.NONE);
        const markdownNodes = [];
        const lines = text.split("\n");
        let metadata = {};
        let codeBlock = false;
        let currentSection = "";
        for (const line of lines){
            if (line.trim().startsWith("```")) {
                codeBlock = !codeBlock;
            }
            const headerMatch = /^(#+)\s(.*)/.exec(line);
            if (headerMatch && !codeBlock) {
                if (currentSection !== "") {
                    markdownNodes.push(this.buildNodeFromSplit(currentSection.trim(), node, metadata));
                }
                metadata = this.updateMetadata(metadata, headerMatch[2], headerMatch[1].trim().length);
                currentSection = `${headerMatch[2]}\n`;
            } else {
                currentSection += line + "\n";
            }
        }
        if (currentSection !== "") {
            markdownNodes.push(this.buildNodeFromSplit(currentSection.trim(), node, metadata));
        }
        return markdownNodes;
    }
    updateMetadata(headersMetadata, newHeader, newHeaderLevel) {
        const updatedHeaders = {};
        for(let i = 1; i < newHeaderLevel; i++){
            const key = `Header_${i}`;
            if (key in headersMetadata) {
                updatedHeaders[key] = headersMetadata[key];
            }
        }
        updatedHeaders[`Header_${newHeaderLevel}`] = newHeader;
        return updatedHeaders;
    }
    buildNodeFromSplit(textSplit, node, metadata) {
        const newNode = buildNodeFromSplits([
            textSplit
        ], node, undefined)[0];
        if (this.includeMetadata) {
            newNode.metadata = {
                ...newNode.metadata,
                ...metadata
            };
        }
        return newNode;
    }
}

class SentenceWindowNodeParser extends NodeParser {
    static{
        this.DEFAULT_WINDOW_SIZE = 3;
    }
    static{
        this.DEFAULT_WINDOW_METADATA_KEY = "window";
    }
    static{
        this.DEFAULT_ORIGINAL_TEXT_METADATA_KEY = "originalText";
    }
    constructor(params){
        super();
        this.sentenceSplitter = splitBySentenceTokenizer();
        this.idGenerator = ()=>randomUUID();
        if (params) {
            const parsedParams = sentenceWindowNodeParserSchema.parse(params);
            this.windowSize = parsedParams.windowSize;
            this.windowMetadataKey = parsedParams.windowMetadataKey;
            this.originalTextMetadataKey = parsedParams.originalTextMetadataKey;
        } else {
            this.windowSize = SentenceWindowNodeParser.DEFAULT_WINDOW_SIZE;
            this.windowMetadataKey = SentenceWindowNodeParser.DEFAULT_WINDOW_METADATA_KEY;
            this.originalTextMetadataKey = SentenceWindowNodeParser.DEFAULT_ORIGINAL_TEXT_METADATA_KEY;
        }
    }
    parseNodes(nodes, showProgress) {
        return nodes.reduce((allNodes, node)=>{
            const nodes = this.buildWindowNodesFromDocuments([
                node
            ]);
            return allNodes.concat(nodes);
        }, []);
    }
    buildWindowNodesFromDocuments(documents) {
        const allNodes = [];
        for (const doc of documents){
            const text = doc.text;
            const textSplits = this.sentenceSplitter(text);
            const nodes = buildNodeFromSplits(textSplits, doc, undefined, this.idGenerator);
            nodes.forEach((node, i)=>{
                const windowNodes = nodes.slice(Math.max(0, i - this.windowSize), Math.min(i + this.windowSize + 1, nodes.length));
                node.metadata[this.windowMetadataKey] = windowNodes.map((n)=>n.text).join(" ");
                node.metadata[this.originalTextMetadataKey] = node.text;
                node.excludedEmbedMetadataKeys.push(this.windowMetadataKey, this.originalTextMetadataKey);
                node.excludedLlmMetadataKeys.push(this.windowMetadataKey, this.originalTextMetadataKey);
            });
            allNodes.push(...nodes);
        }
        return allNodes;
    }
}

/**
 * @deprecated Use `SentenceSplitter` instead
 */ const SimpleNodeParser = SentenceSplitter;

export { MarkdownNodeParser, MetadataAwareTextSplitter, NodeParser, SentenceSplitter, SentenceWindowNodeParser, SimpleNodeParser, TextSplitter, splitByChar, splitByPhraseRegex, splitByRegex, splitBySentenceTokenizer, splitBySep };
