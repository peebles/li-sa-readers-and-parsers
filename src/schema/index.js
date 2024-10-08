import { randomUUID, createSHA256, path, fs } from '../env/index.js';
import { lazyInitHash, chunkSizeCheck } from '../decorator/index.js';
import { extractText } from '../utils/index.js';
import { z } from 'zod';
import { Settings } from '../global/index.js';

function applyDecs2203RFactory() {
    function createAddInitializerMethod(initializers, decoratorFinishedRef) {
        return function addInitializer(initializer) {
            assertNotFinished(decoratorFinishedRef, "addInitializer");
            assertCallable(initializer, "An initializer");
            initializers.push(initializer);
        };
    }
    function memberDec(dec, name, desc, initializers, kind, isStatic, isPrivate, metadata, value) {
        var kindStr;
        switch(kind){
            case 1:
                kindStr = "accessor";
                break;
            case 2:
                kindStr = "method";
                break;
            case 3:
                kindStr = "getter";
                break;
            case 4:
                kindStr = "setter";
                break;
            default:
                kindStr = "field";
        }
        var ctx = {
            kind: kindStr,
            name: isPrivate ? "#" + name : name,
            static: isStatic,
            private: isPrivate,
            metadata: metadata
        };
        var decoratorFinishedRef = {
            v: false
        };
        ctx.addInitializer = createAddInitializerMethod(initializers, decoratorFinishedRef);
        var get, set;
        if (kind === 0) {
            if (isPrivate) {
                get = desc.get;
                set = desc.set;
            } else {
                get = function() {
                    return this[name];
                };
                set = function(v) {
                    this[name] = v;
                };
            }
        } else if (kind === 2) {
            get = function() {
                return desc.value;
            };
        } else {
            if (kind === 1 || kind === 3) {
                get = function() {
                    return desc.get.call(this);
                };
            }
            if (kind === 1 || kind === 4) {
                set = function(v) {
                    desc.set.call(this, v);
                };
            }
        }
        ctx.access = get && set ? {
            get: get,
            set: set
        } : get ? {
            get: get
        } : {
            set: set
        };
        try {
            return dec(value, ctx);
        } finally{
            decoratorFinishedRef.v = true;
        }
    }
    function assertNotFinished(decoratorFinishedRef, fnName) {
        if (decoratorFinishedRef.v) {
            throw new Error("attempted to call " + fnName + " after decoration was finished");
        }
    }
    function assertCallable(fn, hint) {
        if (typeof fn !== "function") {
            throw new TypeError(hint + " must be a function");
        }
    }
    function assertValidReturnValue(kind, value) {
        var type = typeof value;
        if (kind === 1) {
            if (type !== "object" || value === null) {
                throw new TypeError("accessor decorators must return an object with get, set, or init properties or void 0");
            }
            if (value.get !== undefined) {
                assertCallable(value.get, "accessor.get");
            }
            if (value.set !== undefined) {
                assertCallable(value.set, "accessor.set");
            }
            if (value.init !== undefined) {
                assertCallable(value.init, "accessor.init");
            }
        } else if (type !== "function") {
            var hint;
            if (kind === 0) {
                hint = "field";
            } else if (kind === 10) {
                hint = "class";
            } else {
                hint = "method";
            }
            throw new TypeError(hint + " decorators must return a function or void 0");
        }
    }
    function applyMemberDec(ret, base, decInfo, name, kind, isStatic, isPrivate, initializers, metadata) {
        var decs = decInfo[0];
        var desc, init, value;
        if (isPrivate) {
            if (kind === 0 || kind === 1) {
                desc = {
                    get: decInfo[3],
                    set: decInfo[4]
                };
            } else if (kind === 3) {
                desc = {
                    get: decInfo[3]
                };
            } else if (kind === 4) {
                desc = {
                    set: decInfo[3]
                };
            } else {
                desc = {
                    value: decInfo[3]
                };
            }
        } else if (kind !== 0) {
            desc = Object.getOwnPropertyDescriptor(base, name);
        }
        if (kind === 1) {
            value = {
                get: desc.get,
                set: desc.set
            };
        } else if (kind === 2) {
            value = desc.value;
        } else if (kind === 3) {
            value = desc.get;
        } else if (kind === 4) {
            value = desc.set;
        }
        var newValue, get, set;
        if (typeof decs === "function") {
            newValue = memberDec(decs, name, desc, initializers, kind, isStatic, isPrivate, metadata, value);
            if (newValue !== void 0) {
                assertValidReturnValue(kind, newValue);
                if (kind === 0) {
                    init = newValue;
                } else if (kind === 1) {
                    init = newValue.init;
                    get = newValue.get || value.get;
                    set = newValue.set || value.set;
                    value = {
                        get: get,
                        set: set
                    };
                } else {
                    value = newValue;
                }
            }
        } else {
            for(var i = decs.length - 1; i >= 0; i--){
                var dec = decs[i];
                newValue = memberDec(dec, name, desc, initializers, kind, isStatic, isPrivate, metadata, value);
                if (newValue !== void 0) {
                    assertValidReturnValue(kind, newValue);
                    var newInit;
                    if (kind === 0) {
                        newInit = newValue;
                    } else if (kind === 1) {
                        newInit = newValue.init;
                        get = newValue.get || value.get;
                        set = newValue.set || value.set;
                        value = {
                            get: get,
                            set: set
                        };
                    } else {
                        value = newValue;
                    }
                    if (newInit !== void 0) {
                        if (init === void 0) {
                            init = newInit;
                        } else if (typeof init === "function") {
                            init = [
                                init,
                                newInit
                            ];
                        } else {
                            init.push(newInit);
                        }
                    }
                }
            }
        }
        if (kind === 0 || kind === 1) {
            if (init === void 0) {
                init = function(instance, init) {
                    return init;
                };
            } else if (typeof init !== "function") {
                var ownInitializers = init;
                init = function(instance, init) {
                    var value = init;
                    for(var i = 0; i < ownInitializers.length; i++){
                        value = ownInitializers[i].call(instance, value);
                    }
                    return value;
                };
            } else {
                var originalInitializer = init;
                init = function(instance, init) {
                    return originalInitializer.call(instance, init);
                };
            }
            ret.push(init);
        }
        if (kind !== 0) {
            if (kind === 1) {
                desc.get = value.get;
                desc.set = value.set;
            } else if (kind === 2) {
                desc.value = value;
            } else if (kind === 3) {
                desc.get = value;
            } else if (kind === 4) {
                desc.set = value;
            }
            if (isPrivate) {
                if (kind === 1) {
                    ret.push(function(instance, args) {
                        return value.get.call(instance, args);
                    });
                    ret.push(function(instance, args) {
                        return value.set.call(instance, args);
                    });
                } else if (kind === 2) {
                    ret.push(value);
                } else {
                    ret.push(function(instance, args) {
                        return value.call(instance, args);
                    });
                }
            } else {
                Object.defineProperty(base, name, desc);
            }
        }
    }
    function applyMemberDecs(Class, decInfos, metadata) {
        var ret = [];
        var protoInitializers;
        var staticInitializers;
        var existingProtoNonFields = new Map();
        var existingStaticNonFields = new Map();
        for(var i = 0; i < decInfos.length; i++){
            var decInfo = decInfos[i];
            if (!Array.isArray(decInfo)) continue;
            var kind = decInfo[1];
            var name = decInfo[2];
            var isPrivate = decInfo.length > 3;
            var isStatic = kind >= 5;
            var base;
            var initializers;
            if (isStatic) {
                base = Class;
                kind = kind - 5;
                staticInitializers = staticInitializers || [];
                initializers = staticInitializers;
            } else {
                base = Class.prototype;
                protoInitializers = protoInitializers || [];
                initializers = protoInitializers;
            }
            if (kind !== 0 && !isPrivate) {
                var existingNonFields = isStatic ? existingStaticNonFields : existingProtoNonFields;
                var existingKind = existingNonFields.get(name) || 0;
                if (existingKind === true || existingKind === 3 && kind !== 4 || existingKind === 4 && kind !== 3) {
                    throw new Error("Attempted to decorate a public method/accessor that has the same name as a previously decorated public method/accessor. This is not currently supported by the decorators plugin. Property name was: " + name);
                } else if (!existingKind && kind > 2) {
                    existingNonFields.set(name, kind);
                } else {
                    existingNonFields.set(name, true);
                }
            }
            applyMemberDec(ret, base, decInfo, name, kind, isStatic, isPrivate, initializers, metadata);
        }
        pushInitializers(ret, protoInitializers);
        pushInitializers(ret, staticInitializers);
        return ret;
    }
    function pushInitializers(ret, initializers) {
        if (initializers) {
            ret.push(function(instance) {
                for(var i = 0; i < initializers.length; i++){
                    initializers[i].call(instance);
                }
                return instance;
            });
        }
    }
    function applyClassDecs(targetClass, classDecs, metadata) {
        if (classDecs.length > 0) {
            var initializers = [];
            var newClass = targetClass;
            var name = targetClass.name;
            for(var i = classDecs.length - 1; i >= 0; i--){
                var decoratorFinishedRef = {
                    v: false
                };
                try {
                    var nextNewClass = classDecs[i](newClass, {
                        kind: "class",
                        name: name,
                        addInitializer: createAddInitializerMethod(initializers, decoratorFinishedRef),
                        metadata
                    });
                } finally{
                    decoratorFinishedRef.v = true;
                }
                if (nextNewClass !== undefined) {
                    assertValidReturnValue(10, nextNewClass);
                    newClass = nextNewClass;
                }
            }
            return [
                defineMetadata(newClass, metadata),
                function() {
                    for(var i = 0; i < initializers.length; i++){
                        initializers[i].call(newClass);
                    }
                }
            ];
        }
    }
    function defineMetadata(Class, metadata) {
        return Object.defineProperty(Class, Symbol.metadata || Symbol.for("Symbol.metadata"), {
            configurable: true,
            enumerable: true,
            value: metadata
        });
    }
    return function applyDecs2203R(targetClass, memberDecs, classDecs, parentClass) {
        if (parentClass !== void 0) {
            var parentMetadata = parentClass[Symbol.metadata || Symbol.for("Symbol.metadata")];
        }
        var metadata = Object.create(parentMetadata === void 0 ? null : parentMetadata);
        var e = applyMemberDecs(targetClass, memberDecs, metadata);
        if (!classDecs.length) defineMetadata(targetClass, metadata);
        return {
            e: e,
            get c () {
                return applyClassDecs(targetClass, classDecs, metadata);
            }
        };
    };
}
function _apply_decs_2203_r(targetClass, memberDecs, classDecs, parentClass) {
    return (_apply_decs_2203_r = applyDecs2203RFactory())(targetClass, memberDecs, classDecs, parentClass);
}
var _init_hash, _initProto, _initProto1;
var NodeRelationship;
(function(NodeRelationship) {
    NodeRelationship["SOURCE"] = "SOURCE";
    NodeRelationship["PREVIOUS"] = "PREVIOUS";
    NodeRelationship["NEXT"] = "NEXT";
    NodeRelationship["PARENT"] = "PARENT";
    NodeRelationship["CHILD"] = "CHILD";
})(NodeRelationship || (NodeRelationship = {}));
var ObjectType;
(function(ObjectType) {
    ObjectType["TEXT"] = "TEXT";
    ObjectType["IMAGE"] = "IMAGE";
    ObjectType["INDEX"] = "INDEX";
    ObjectType["DOCUMENT"] = "DOCUMENT";
    ObjectType["IMAGE_DOCUMENT"] = "IMAGE_DOCUMENT";
})(ObjectType || (ObjectType = {}));
var MetadataMode;
(function(MetadataMode) {
    MetadataMode["ALL"] = "ALL";
    MetadataMode["EMBED"] = "EMBED";
    MetadataMode["LLM"] = "LLM";
    MetadataMode["NONE"] = "NONE";
})(MetadataMode || (MetadataMode = {}));
/**
 * Generic abstract class for retrievable nodes
 */ class BaseNode {
    static{
        ({ e: [_init_hash, _initProto] } = _apply_decs_2203_r(this, [
            [
                lazyInitHash,
                1,
                "hash"
            ]
        ], []));
    }
    #___private_hash_1;
    get hash() {
        return this.#___private_hash_1;
    }
    set hash(_v) {
        this.#___private_hash_1 = _v;
    }
    constructor(init){
        this.#___private_hash_1 = (_initProto(this), _init_hash(this, ""));
        const { id_, metadata, excludedEmbedMetadataKeys, excludedLlmMetadataKeys, relationships, hash, embedding } = init || {};
        this.id_ = id_ ?? randomUUID();
        this.metadata = metadata ?? {};
        this.excludedEmbedMetadataKeys = excludedEmbedMetadataKeys ?? [];
        this.excludedLlmMetadataKeys = excludedLlmMetadataKeys ?? [];
        this.relationships = relationships ?? {};
        this.embedding = embedding;
    }
    get sourceNode() {
        const relationship = this.relationships["SOURCE"];
        if (Array.isArray(relationship)) {
            throw new Error("Source object must be a single RelatedNodeInfo object");
        }
        return relationship;
    }
    get prevNode() {
        const relationship = this.relationships["PREVIOUS"];
        if (Array.isArray(relationship)) {
            throw new Error("Previous object must be a single RelatedNodeInfo object");
        }
        return relationship;
    }
    get nextNode() {
        const relationship = this.relationships["NEXT"];
        if (Array.isArray(relationship)) {
            throw new Error("Next object must be a single RelatedNodeInfo object");
        }
        return relationship;
    }
    get parentNode() {
        const relationship = this.relationships["PARENT"];
        if (Array.isArray(relationship)) {
            throw new Error("Parent object must be a single RelatedNodeInfo object");
        }
        return relationship;
    }
    get childNodes() {
        const relationship = this.relationships["CHILD"];
        if (!Array.isArray(relationship)) {
            throw new Error("Child object must be a an array of RelatedNodeInfo objects");
        }
        return relationship;
    }
    getEmbedding() {
        if (this.embedding === undefined) {
            throw new Error("Embedding not set");
        }
        return this.embedding;
    }
    asRelatedNodeInfo() {
        return {
            nodeId: this.id_,
            metadata: this.metadata,
            hash: this.hash
        };
    }
    /**
   * Called by built in JSON.stringify (see https://javascript.info/json)
   * Properties are read-only as they are not deep-cloned (not necessary for stringification).
   * @see toMutableJSON - use to return a mutable JSON instead
   */ toJSON() {
        return {
            ...this,
            type: this.type,
            // hash is an accessor property, so it's not included in the rest operator
            hash: this.hash
        };
    }
    clone() {
        return jsonToNode(this.toMutableJSON());
    }
    /**
   * Converts the object to a JSON representation.
   * Properties can be safely modified as a deep clone of the properties are created.
   * @return {Record<string, any>} - The JSON representation of the object.
   */ toMutableJSON() {
        return structuredClone(this.toJSON());
    }
}
/**
 * TextNode is the default node type for text. Most common node type in LlamaIndex.TS
 */ class TextNode extends BaseNode {
    static{
        ({ e: [_initProto1] } = _apply_decs_2203_r(this, [
            [
                chunkSizeCheck,
                2,
                "getContent"
            ]
        ], []));
    }
    constructor(init = {}){
        super(init);
        _initProto1(this);
        const { text, textTemplate, startCharIdx, endCharIdx, metadataSeparator } = init;
        this.text = text ?? "";
        this.textTemplate = textTemplate ?? "";
        if (startCharIdx) {
            this.startCharIdx = startCharIdx;
        }
        if (endCharIdx) {
            this.endCharIdx = endCharIdx;
        }
        this.metadataSeparator = metadataSeparator ?? "\n";
    }
    /**
   * Generate a hash of the text node.
   * The ID is not part of the hash as it can change independent of content.
   * @returns
   */ generateHash() {
        const hashFunction = createSHA256();
        hashFunction.update(`type=${this.type}`);
        hashFunction.update(`startCharIdx=${this.startCharIdx} endCharIdx=${this.endCharIdx}`);
        hashFunction.update(this.getContent("ALL"));
        return hashFunction.digest();
    }
    get type() {
        return "TEXT";
    }
    getContent(metadataMode = "NONE") {
        const metadataStr = this.getMetadataStr(metadataMode).trim();
        return `${metadataStr}\n\n${this.text}`.trim();
    }
    getMetadataStr(metadataMode) {
        if (metadataMode === "NONE") {
            return "";
        }
        const usableMetadataKeys = new Set(Object.keys(this.metadata).sort());
        if (metadataMode === "LLM") {
            for (const key of this.excludedLlmMetadataKeys){
                usableMetadataKeys.delete(key);
            }
        } else if (metadataMode === "EMBED") {
            for (const key of this.excludedEmbedMetadataKeys){
                usableMetadataKeys.delete(key);
            }
        }
        return [
            ...usableMetadataKeys
        ].map((key)=>`${key}: ${this.metadata[key]}`).join(this.metadataSeparator);
    }
    setContent(value) {
        this.text = value;
        this.hash = this.generateHash();
    }
    getNodeInfo() {
        return {
            start: this.startCharIdx,
            end: this.endCharIdx
        };
    }
    getText() {
        return this.getContent("NONE");
    }
}
class IndexNode extends TextNode {
    constructor(init){
        super(init);
        const { indexId } = init || {};
        this.indexId = indexId ?? "";
    }
    get type() {
        return "INDEX";
    }
}
/**
 * A document is just a special text node with a docId.
 */ class Document extends TextNode {
    constructor(init){
        super(init);
    }
    get type() {
        return "DOCUMENT";
    }
}
function jsonToNode(json, type) {
    if (!json.type && !type) {
        throw new Error("Node type not found");
    }
    const nodeType = type || json.type;
    switch(nodeType){
        case "TEXT":
            return new TextNode(json);
        case "INDEX":
            return new IndexNode(json);
        case "DOCUMENT":
            return new Document(json);
        case "IMAGE_DOCUMENT":
            return new ImageDocument(json);
        default:
            throw new Error(`Invalid node type: ${nodeType}`);
    }
}
class ImageNode extends TextNode {
    constructor(init){
        super(init);
        const { image } = init;
        this.image = image;
    }
    get type() {
        return "IMAGE";
    }
    getUrl() {
        // id_ stores the relative path, convert it to the URL of the file
        const absPath = path.resolve(this.id_);
        return new URL(`file://${absPath}`);
    }
    // Calculates the image part of the hash
    generateImageHash() {
        const hashFunction = createSHA256();
        if (this.image instanceof Blob) {
            // TODO: ideally we should use the blob's content to calculate the hash:
            // hashFunction.update(new Uint8Array(await this.image.arrayBuffer()));
            // as this is async, we're using the node's ID for the time being
            hashFunction.update(this.id_);
        } else if (this.image instanceof URL) {
            hashFunction.update(this.image.toString());
        } else if (typeof this.image === "string") {
            hashFunction.update(this.image);
        } else {
            throw new Error(`Unknown image type: ${typeof this.image}. Can't calculate hash`);
        }
        return hashFunction.digest();
    }
    generateHash() {
        const hashFunction = createSHA256();
        // calculates hash based on hash of both components (image and text)
        hashFunction.update(super.generateHash());
        hashFunction.update(this.generateImageHash());
        return hashFunction.digest();
    }
}
class ImageDocument extends ImageNode {
    constructor(init){
        super(init);
    }
    get type() {
        return "IMAGE_DOCUMENT";
    }
}
var ModalityType;
(function(ModalityType) {
    ModalityType["TEXT"] = "TEXT";
    ModalityType["IMAGE"] = "IMAGE";
})(ModalityType || (ModalityType = {}));
function splitNodesByType(nodes) {
    const result = {};
    for (const node of nodes){
        let type;
        if (node instanceof ImageNode) {
            type = "IMAGE";
        } else if (node instanceof TextNode) {
            type = "TEXT";
        } else {
            throw new Error(`Unknown node type: ${node.type}`);
        }
        if (type in result) {
            result[type]?.push(node);
        } else {
            result[type] = [
                node
            ];
        }
    }
    return result;
}
function buildNodeFromSplits(textSplits, doc, refDoc = doc, idGenerator = ()=>randomUUID()) {
    const nodes = [];
    const relationships = {
        ["SOURCE"]: refDoc.asRelatedNodeInfo()
    };
    textSplits.forEach((textChunk, i)=>{
        if (doc instanceof ImageDocument) {
            const imageNode = new ImageNode({
                id_: idGenerator(i, doc),
                text: textChunk,
                image: doc.image,
                embedding: doc.embedding,
                excludedEmbedMetadataKeys: [
                    ...doc.excludedEmbedMetadataKeys
                ],
                excludedLlmMetadataKeys: [
                    ...doc.excludedLlmMetadataKeys
                ],
                metadataSeparator: doc.metadataSeparator,
                textTemplate: doc.textTemplate,
                relationships: {
                    ...relationships
                }
            });
            nodes.push(imageNode);
        } else if (doc instanceof Document || doc instanceof TextNode) {
            const node = new TextNode({
                id_: idGenerator(i, doc),
                text: textChunk,
                embedding: doc.embedding,
                excludedEmbedMetadataKeys: [
                    ...doc.excludedEmbedMetadataKeys
                ],
                excludedLlmMetadataKeys: [
                    ...doc.excludedLlmMetadataKeys
                ],
                metadataSeparator: doc.metadataSeparator,
                textTemplate: doc.textTemplate,
                relationships: {
                    ...relationships
                }
            });
            nodes.push(node);
        } else {
            throw new Error(`Unknown document type: ${doc.type}`);
        }
    });
    return nodes;
}

class TransformComponent {
    constructor(transformFn){
        Object.defineProperties(transformFn, Object.getOwnPropertyDescriptors(this.constructor.prototype));
        const transform = function transform(...args) {
            return transformFn(...args);
        };
        Reflect.setPrototypeOf(transform, new.target.prototype);
        transform.id = randomUUID();
        return transform;
    }
}
/**
 * A FileReader takes file paths and imports data into Document objects.
 */ class FileReader {
    async loadData(filePath) {
        const fileContent = await fs.readFile(filePath);
        const fileName = path.basename(filePath);
        const docs = await this.loadDataAsContent(fileContent, fileName);
        docs.forEach(FileReader.addMetaData(filePath));
        return docs;
    }
    static addMetaData(filePath) {
        return (doc, index)=>{
            // generate id as loadDataAsContent is only responsible for the content
            doc.id_ = `${filePath}_${index + 1}`;
            doc.metadata["file_path"] = path.resolve(filePath);
            doc.metadata["file_name"] = path.basename(filePath);
        };
    }
}

class EngineResponse {
    constructor(chatResponse, stream, sourceNodes){
        this.metadata = {};
        this.message = chatResponse.message;
        this.raw = chatResponse.raw;
        this.sourceNodes = sourceNodes;
        this.stream = stream;
    }
    static fromResponse(response, stream, sourceNodes) {
        return new EngineResponse(EngineResponse.toChatResponse(response), stream, sourceNodes);
    }
    static toChatResponse(response, raw = null) {
        return {
            message: {
                content: response,
                role: "assistant"
            },
            raw
        };
    }
    static fromChatResponse(chatResponse, sourceNodes) {
        return new EngineResponse(chatResponse, false, sourceNodes);
    }
    static fromChatResponseChunk(chunk, sourceNodes) {
        return new EngineResponse(EngineResponse.toChatResponse(chunk.delta, chunk.raw), true, sourceNodes);
    }
    /**
   * @deprecated Use `message` instead.
   */ get response() {
        return extractText(this.message.content);
    }
    get delta() {
        if (!this.stream) {
            console.warn("delta is only available for streaming responses. Consider using 'message' instead.");
        }
        return extractText(this.message.content);
    }
    toString() {
        return this.response ?? "";
    }
}

const anyFunctionSchema = z.function(z.tuple([]).rest(z.any()), z.any());
const toolMetadataSchema = z.object({
    description: z.string(),
    name: z.string(),
    parameters: z.record(z.any())
});
const baseToolSchema = z.object({
    call: anyFunctionSchema.optional(),
    metadata: toolMetadataSchema
});
const baseToolWithCallSchema = baseToolSchema.extend({
    call: z.function()
});
const sentenceSplitterSchema = z.object({
    chunkSize: z.number({
        description: "The token chunk size for each chunk."
    }).gt(0).optional().default(()=>Settings.chunkSize ?? 1024),
    chunkOverlap: z.number({
        description: "The token overlap of each chunk when splitting."
    }).gte(0).optional().default(200),
    separator: z.string({
        description: "Default separator for splitting into words"
    }).default(" "),
    paragraphSeparator: z.string({
        description: "Separator between paragraphs."
    }).optional().default("\n\n\n"),
    secondaryChunkingRegex: z.string({
        description: "Backup regex for splitting into sentences."
    }).optional().default("[^,.;。？！]+[,.;。？！]?")
}).refine((data)=>data.chunkOverlap < data.chunkSize, "Chunk overlap must be less than chunk size.");
const sentenceWindowNodeParserSchema = z.object({
    windowSize: z.number({
        description: "The number of sentences on each side of a sentence to capture."
    }).gt(0).default(3),
    windowMetadataKey: z.string({
        description: "The metadata key to store the sentence window under."
    }).default("window"),
    originalTextMetadataKey: z.string({
        description: "The metadata key to store the original sentence in."
    }).default("originalText")
});

export { BaseNode, Document, EngineResponse, FileReader, ImageDocument, ImageNode, IndexNode, MetadataMode, ModalityType, NodeRelationship, ObjectType, TextNode, TransformComponent, anyFunctionSchema, baseToolSchema, baseToolWithCallSchema, buildNodeFromSplits, jsonToNode, sentenceSplitterSchema, sentenceWindowNodeParserSchema, splitNodesByType, toolMetadataSchema };
