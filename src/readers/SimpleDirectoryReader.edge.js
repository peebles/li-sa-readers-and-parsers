import { path } from "../env/index.js";
import { walk } from "../storage/FileSystem.js";
import { TextFileReader } from "./TextFileReader.js";
import pLimit from "./utils.js";
var ReaderStatus;
(function(ReaderStatus) {
    ReaderStatus[ReaderStatus["STARTED"] = 0] = "STARTED";
    ReaderStatus[ReaderStatus["COMPLETE"] = 1] = "COMPLETE";
    ReaderStatus[ReaderStatus["ERROR"] = 2] = "ERROR";
})(ReaderStatus || (ReaderStatus = {}));
/**
 * Read all the documents in a directory.
 * By default, supports the list of file types
 * in the FILE_EXT_TO_READER map.
 */ export class SimpleDirectoryReader {
    observer;
    constructor(observer){
        this.observer = observer;
    }
    async loadData(params) {
        if (typeof params === "string") {
            params = {
                directoryPath: params
            };
        }
        const { directoryPath, defaultReader = new TextFileReader(), fileExtToReader, numWorkers = 1, overrideReader } = params;
        if (numWorkers < 1 || numWorkers > 9) {
            throw new Error("The number of workers must be between 1 - 9.");
        }
        // Observer can decide to skip the directory
        if (!this.doObserverCheck("directory", directoryPath, 0)) {
            return [];
        }
        // Crates a queue of file paths each worker accesses individually
        const filePathQueue = [];
        for await (const filePath of walk(directoryPath)){
            filePathQueue.push(filePath);
        }
        const processFileParams = {
            defaultReader,
            fileExtToReader,
            overrideReader
        };
        // Uses pLimit to control number of parallel requests
        const limit = pLimit(numWorkers);
        const workerPromises = filePathQueue.map((filePath)=>limit(()=>this.processFile(filePath, processFileParams)));
        const results = await Promise.all(workerPromises);
        // After successful import of all files, directory completion
        // is only a notification for observer, cannot be cancelled.
        this.doObserverCheck("directory", directoryPath, 1);
        return results.flat();
    }
    async processFile(filePath, params) {
        const docs = [];
        try {
            const fileExt = path.extname(filePath).slice(1).toLowerCase();
            // Observer can decide to skip each file
            if (!this.doObserverCheck("file", filePath, 0)) {
                // Skip this file
                return [];
            }
            let reader;
            if (params.overrideReader) {
                reader = params.overrideReader;
            } else if (params.fileExtToReader && fileExt in params.fileExtToReader) {
                reader = params.fileExtToReader[fileExt];
            } else if (params.defaultReader != null) {
                reader = params.defaultReader;
            } else {
                const msg = `No reader for file extension of ${filePath}`;
                console.warn(msg);
                // In an error condition, observer's false cancels the whole process.
                if (!this.doObserverCheck("file", filePath, 2, msg)) {
                    return [];
                }
                return [];
            }
            const fileDocs = await reader.loadData(filePath);
            // Observer can still cancel addition of the resulting docs from this file
            if (this.doObserverCheck("file", filePath, 1)) {
                docs.push(...fileDocs);
            }
        } catch (e) {
            const msg = `Error reading file ${filePath}: ${e}`;
            console.error(msg);
            // In an error condition, observer's false cancels the whole process.
            if (!this.doObserverCheck("file", filePath, 2, msg)) {
                return [];
            }
        }
        return docs;
    }
    doObserverCheck(category, name, status, message) {
        if (this.observer) {
            return this.observer(category, name, status, message);
        }
        return true;
    }
}
