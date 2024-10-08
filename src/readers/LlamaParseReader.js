import { Document, FileReader } from "../schema/index.js";
import { fs, getEnv } from "../env/index.js";
const SUPPORT_FILE_EXT = [
    ".pdf",
    // document and presentations
    ".602",
    ".abw",
    ".cgm",
    ".cwk",
    ".doc",
    ".docx",
    ".docm",
    ".dot",
    ".dotm",
    ".hwp",
    ".key",
    ".lwp",
    ".mw",
    ".mcw",
    ".pages",
    ".pbd",
    ".ppt",
    ".pptm",
    ".pptx",
    ".pot",
    ".potm",
    ".potx",
    ".rtf",
    ".sda",
    ".sdd",
    ".sdp",
    ".sdw",
    ".sgl",
    ".sti",
    ".sxi",
    ".sxw",
    ".stw",
    ".sxg",
    ".txt",
    ".uof",
    ".uop",
    ".uot",
    ".vor",
    ".wpd",
    ".wps",
    ".xml",
    ".zabw",
    ".epub",
    // images
    ".jpg",
    ".jpeg",
    ".png",
    ".gif",
    ".bmp",
    ".svg",
    ".tiff",
    ".webp",
    // web
    ".htm",
    ".html",
    // spreadsheets
    ".xlsx",
    ".xls",
    ".xlsm",
    ".xlsb",
    ".xlw",
    ".csv",
    ".dif",
    ".sylk",
    ".slk",
    ".prn",
    ".numbers",
    ".et",
    ".ods",
    ".fods",
    ".uos1",
    ".uos2",
    ".dbf",
    ".wk1",
    ".wk2",
    ".wk3",
    ".wk4",
    ".wks",
    ".123",
    ".wq1",
    ".wq2",
    ".wb1",
    ".wb2",
    ".wb3",
    ".qpw",
    ".xlr",
    ".eth",
    ".tsv"
];
/**
 * Represents a reader for parsing files using the LlamaParse API.
 * See https://github.com/run-llama/llama_parse
 */ export class LlamaParseReader extends FileReader {
    // The API key for the LlamaParse API. Can be set as an environment variable: LLAMA_CLOUD_API_KEY
    apiKey;
    // The base URL of the Llama Parsing API.
    baseUrl = "https://api.cloud.llamaindex.ai/api/parsing";
    // The result type for the parser.
    resultType = "text";
    // The interval in seconds to check if the parsing is done.
    checkInterval = 1;
    // The maximum timeout in seconds to wait for the parsing to finish.
    maxTimeout = 2000;
    // Whether to print the progress of the parsing.
    verbose = true;
    // The language of the text to parse.
    language = "en";
    // The parsing instruction for the parser. Backend default is an empty string.
    parsingInstruction;
    // Wether to ignore diagonal text (when the text rotation in degrees is not 0, 90, 180 or 270, so not a horizontal or vertical text). Backend default is false.
    skipDiagonalText;
    // Wheter to ignore the cache and re-process the document. All documents are kept in cache for 48hours after the job was completed to avoid processing the same document twice. Backend default is false.
    invalidateCache;
    // Wether the document should not be cached in the first place. Backend default is false.
    doNotCache;
    // Wether to use a faster mode to extract text from documents. This mode will skip OCR of images, and table/heading reconstruction. Note: Non-compatible with gpt4oMode. Backend default is false.
    fastMode;
    // Wether to keep column in the text according to document layout. Reduce reconstruction accuracy, and LLM's/embedings performances in most cases.
    doNotUnrollColumns;
    // A templated page separator to use to split the text. If the results contain `{page_number}` (e.g. JSON mode), it will be replaced by the next page number. If not set the default separator '\\n---\\n' will be used.
    pageSeparator;
    //A templated prefix to add to the beginning of each page. If the results contain `{page_number}`, it will be replaced by the page number.>
    pagePrefix;
    // A templated suffix to add to the end of each page. If the results contain `{page_number}`, it will be replaced by the page number.
    pageSuffix;
    // Deprecated. Use vendorMultimodal params. Whether to use gpt-4o to extract text from documents.
    gpt4oMode = false;
    // Deprecated. Use vendorMultimodal params. The API key for the GPT-4o API. Optional, lowers the cost of parsing. Can be set as an env variable: LLAMA_CLOUD_GPT4O_API_KEY.
    gpt4oApiKey;
    // The bounding box to use to extract text from documents. Describe as a string containing the bounding box margins.
    boundingBox;
    // The target pages to extract text from documents. Describe as a comma separated list of page numbers. The first page of the document is page 0
    targetPages;
    // Whether or not to ignore and skip errors raised during parsing.
    ignoreErrors = true;
    // Whether to split by page using the pageSeparator or '\n---\n' as default.
    splitByPage = true;
    // Whether to use the vendor multimodal API.
    useVendorMultimodalModel = false;
    // The model name for the vendor multimodal API
    vendorMultimodalModelName;
    // The API key for the multimodal API. Can also be set as an env variable: LLAMA_CLOUD_VENDOR_MULTIMODAL_API_KEY
    vendorMultimodalApiKey;
    // numWorkers is implemented in SimpleDirectoryReader
    constructor(params = {}){
        super();
        Object.assign(this, params);
        params.apiKey = params.apiKey ?? getEnv("LLAMA_CLOUD_API_KEY");
        if (!params.apiKey) {
            throw new Error("API Key is required for LlamaParseReader. Please pass the apiKey parameter or set the LLAMA_CLOUD_API_KEY environment variable.");
        }
        this.apiKey = params.apiKey;
        if (params.gpt4oMode) {
            params.gpt4oApiKey = params.gpt4oApiKey ?? getEnv("LLAMA_CLOUD_GPT4O_API_KEY");
            this.gpt4oApiKey = params.gpt4oApiKey;
        }
        if (params.useVendorMultimodalModel) {
            params.vendorMultimodalApiKey = params.vendorMultimodalApiKey ?? getEnv("LLAMA_CLOUD_VENDOR_MULTIMODAL_API_KEY");
            this.vendorMultimodalApiKey = params.vendorMultimodalApiKey;
        }
    }
    // Create a job for the LlamaParse API
    async createJob(data, fileName) {
        // Load data, set the mime type
        const { mime, extension } = await LlamaParseReader.getMimeType(data);
        if (this.verbose) {
            const name = fileName ? fileName : extension;
            console.log(`Starting load for ${name} file`);
        }
        const body = new FormData();
        body.set("file", new Blob([
            data
        ], {
            type: mime
        }), fileName);
        const LlamaParseBodyParams = {
            language: this.language,
            parsing_instruction: this.parsingInstruction,
            skip_diagonal_text: this.skipDiagonalText?.toString(),
            invalidate_cache: this.invalidateCache?.toString(),
            do_not_cache: this.doNotCache?.toString(),
            fast_mode: this.fastMode?.toString(),
            do_not_unroll_columns: this.doNotUnrollColumns?.toString(),
            page_separator: this.pageSeparator,
            page_prefix: this.pagePrefix,
            page_suffix: this.pageSuffix,
            gpt4o_mode: this.gpt4oMode?.toString(),
            gpt4o_api_key: this.gpt4oApiKey,
            bounding_box: this.boundingBox,
            target_pages: this.targetPages,
            use_vendor_multimodal_model: this.useVendorMultimodalModel?.toString(),
            vendor_multimodal_model_name: this.vendorMultimodalModelName,
            vendor_multimodal_api_key: this.vendorMultimodalApiKey
        };
        // Filter out params with invalid values that would cause issues on the backend.
        const filteredParams = this.filterSpecificParams(LlamaParseBodyParams, [
            "page_separator",
            "page_prefix",
            "page_suffix",
            "bounding_box",
            "target_pages"
        ]);
        // Appends body with any defined LlamaParseBodyParams
        Object.entries(filteredParams).forEach(([key, value])=>{
            if (value !== undefined) {
                body.append(key, value);
            }
        });
        const headers = {
            Authorization: `Bearer ${this.apiKey}`
        };
        // Send the request, start job
        const url = `${this.baseUrl}/upload`;
        const response = await fetch(url, {
            signal: AbortSignal.timeout(this.maxTimeout * 1000),
            method: "POST",
            body,
            headers
        });
        if (!response.ok) {
            throw new Error(`Failed to parse the file: ${await response.text()}`);
        }
        const jsonResponse = await response.json();
        return jsonResponse.id;
    }
    // Get the result of the job
    async getJobResult(jobId, resultType) {
        const resultUrl = `${this.baseUrl}/job/${jobId}/result/${resultType}`;
        const statusUrl = `${this.baseUrl}/job/${jobId}`;
        const headers = {
            Authorization: `Bearer ${this.apiKey}`
        };
        const signal = AbortSignal.timeout(this.maxTimeout * 1000);
        let tries = 0;
        while(true){
            await new Promise((resolve)=>setTimeout(resolve, this.checkInterval * 1000));
            // Check the job status. If unsuccessful response, checks if maximum timeout has been reached. If reached, throws an error
            const statusResponse = await fetch(statusUrl, {
                headers,
                signal
            });
            if (!statusResponse.ok) {
                signal.throwIfAborted();
                if (this.verbose && tries % 10 === 0) {
                    process.stdout.write(".");
                }
                tries++;
                continue;
            }
            // If response is succesful, check status of job. Allowed values "PENDING", "SUCCESS", "ERROR", "CANCELED"
            const statusJson = await statusResponse.json();
            const status = statusJson.status;
            // If job has completed, return the result
            if (status === "SUCCESS") {
                const resultResponse = await fetch(resultUrl, {
                    headers,
                    signal
                });
                if (!resultResponse.ok) {
                    throw new Error(`Failed to fetch result: ${await resultResponse.text()}`);
                }
                return resultResponse.json();
            // If job is still pending, check if maximum timeout has been reached. If reached, throws an error
            } else if (status === "PENDING") {
                signal.throwIfAborted();
                if (this.verbose && tries % 10 === 0) {
                    process.stdout.write(".");
                }
                tries++;
            } else {
                throw new Error(`Failed to parse the file: ${jobId}, status: ${status}`);
            }
        }
    }
    /**
   * Loads data from a file and returns an array of Document objects.
   * To be used with resultType = "text" and "markdown"
   *
   * @param {Uint8Array} fileContent - The content of the file to be loaded.
   * @param {string} [fileName] - The optional name of the file to be loaded.
   * @return {Promise<Document[]>} A Promise object that resolves to an array of Document objects.
   */ async loadDataAsContent(fileContent, fileName) {
        let jobId;
        try {
            // Creates a job for the file
            jobId = await this.createJob(fileContent, fileName);
            if (this.verbose) {
                console.log(`Started parsing the file under job id ${jobId}`);
            }
            // Return results as Document objects
            const jobResults = await this.getJobResult(jobId, this.resultType);
            const resultText = jobResults[this.resultType];
            // Split the text by separator if splitByPage is true
            if (this.splitByPage) {
                return this.splitTextBySeparator(resultText);
            }
            return [
                new Document({
                    text: resultText
                })
            ];
        } catch (e) {
            console.error(`Error while parsing file under job id ${jobId}`, e);
            if (this.ignoreErrors) {
                return [];
            } else {
                throw e;
            }
        }
    }
    /**
   * Loads data from a file and returns an array of JSON objects.
   * To be used with resultType = "json"
   *
   * @param {string} filePathOrContent - The file path to the file or the content of the file as a Buffer
   * @return {Promise<Record<string, any>[]>} A Promise that resolves to an array of JSON objects.
   */ async loadJson(filePathOrContent) {
        let jobId;
        const isFilePath = typeof filePathOrContent === "string";
        try {
            const data = isFilePath ? await fs.readFile(filePathOrContent) : filePathOrContent;
            // Creates a job for the file
            jobId = await this.createJob(data);
            if (this.verbose) {
                console.log(`Started parsing the file under job id ${jobId}`);
            }
            // Return results as an array of JSON objects (same format as Python version of the reader)
            const resultJson = await this.getJobResult(jobId, "json");
            resultJson.job_id = jobId;
            resultJson.file_path = isFilePath ? filePathOrContent : undefined;
            return [
                resultJson
            ];
        } catch (e) {
            console.error(`Error while parsing the file under job id ${jobId}`, e);
            if (this.ignoreErrors) {
                return [];
            } else {
                throw e;
            }
        }
    }
    /**
   * Downloads and saves images from a given JSON result to a specified download path.
   * Currently only supports resultType = "json"
   *
   * @param {Record<string, any>[]} jsonResult - The JSON result containing image information.
   * @param {string} downloadPath - The path to save the downloaded images.
   * @return {Promise<Record<string, any>[]>} A Promise that resolves to an array of image objects.
   */ async getImages(jsonResult, downloadPath) {
        try {
            // Create download directory if it doesn't exist (Actually check for write access, not existence, since fsPromises does not have a `existsSync` method)
            try {
                await fs.access(downloadPath);
            } catch  {
                await fs.mkdir(downloadPath, {
                    recursive: true
                });
            }
            const images = [];
            for (const result of jsonResult){
                const jobId = result.job_id;
                for (const page of result.pages){
                    if (this.verbose) {
                        console.log(`> Image for page ${page.page}: ${page.images}`);
                    }
                    for (const image of page.images){
                        const imageName = image.name;
                        const imagePath = await this.getImagePath(downloadPath, jobId, imageName);
                        await this.fetchAndSaveImage(imageName, imagePath, jobId);
                        // Assign metadata to the image
                        image.path = imagePath;
                        image.job_id = jobId;
                        image.original_pdf_path = result.file_path;
                        image.page_number = page.page;
                        images.push(image);
                    }
                }
            }
            return images;
        } catch (e) {
            console.error(`Error while downloading images from the parsed result`, e);
            if (this.ignoreErrors) {
                return [];
            } else {
                throw e;
            }
        }
    }
    async getImagePath(downloadPath, jobId, imageName) {
        // Get the full path
        let imagePath = `${downloadPath}/${jobId}-${imageName}`;
        // Get a valid image path
        if (!imagePath.endsWith(".png") && !imagePath.endsWith(".jpg")) {
            imagePath += ".png";
        }
        return imagePath;
    }
    async fetchAndSaveImage(imageName, imagePath, jobId) {
        const headers = {
            Authorization: `Bearer ${this.apiKey}`
        };
        // Construct the image URL
        const imageUrl = `${this.baseUrl}/job/${jobId}/result/image/${imageName}`;
        const response = await fetch(imageUrl, {
            headers
        });
        if (!response.ok) {
            throw new Error(`Failed to download image: ${await response.text()}`);
        }
        // Convert the response to an ArrayBuffer and then to a Buffer
        const arrayBuffer = await response.arrayBuffer();
        const buffer = new Uint8Array(arrayBuffer);
        // Write the image buffer to the specified imagePath
        await fs.writeFile(imagePath, buffer);
    }
    // Filters out invalid values (null, undefined, empty string) of specific params.
    filterSpecificParams(params, keysToCheck) {
        const filteredParams = {};
        for (const [key, value] of Object.entries(params)){
            if (keysToCheck.includes(key)) {
                if (value !== null && value !== undefined && value !== "") {
                    filteredParams[key] = value;
                }
            } else {
                filteredParams[key] = value;
            }
        }
        return filteredParams;
    }
    splitTextBySeparator(text) {
        const separator = this.pageSeparator ?? "\n---\n";
        const textChunks = text.split(separator);
        return textChunks.map((docChunk)=>new Document({
                text: docChunk
            }));
    }
    static async getMimeType(data) {
        const { filetypeinfo } = await import("magic-bytes.js");
        const typeinfos = filetypeinfo(data);
        // find the first type info that matches the supported MIME types
        // It could be happened that docx file is recognized as zip file, so we need to check the mime type
        const info = typeinfos.find((info)=>{
            if (info.extension && SUPPORT_FILE_EXT.includes(`.${info.extension}`)) {
                return info;
            }
        });
        if (!info || !info.mime || !info.extension) {
            const ext = SUPPORT_FILE_EXT.join(", ");
            throw new Error(`File has type which does not match supported MIME Types. Supported formats include: ${ext}`);
        }
        return {
            mime: info.mime,
            extension: info.extension
        };
    }
}
