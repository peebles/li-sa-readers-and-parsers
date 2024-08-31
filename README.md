# LlamaIndex Standalone Readers and Parsers

This is a small package that includes most of the basic file readers and parsers/splitters from [LlamaIndex](https://github.com/run-llama/LlamaIndexTS).  LlamaIndex is great, but if you only want the simple RAG content splitters, well this package is for you.

## Example Usage

```js
import { MarkdownReader, MarkdownNodeParser } from "li-sa-readers-and-parsers"

const reader = new MarkdownReader()
const parser = new MarkdownNodeParser()

const docs = await reader.loadData("./README.md")
const splits = await parser.getNodesFromDocuments(docs)

for (split of splits) { 
    console.log(split.getContent()) 
}
```

## Readers

The file readers included in this package are:

* PapaCSVReader
* DocxReader
* HTMLReader
* ImageReader
* MarkdownReader
* PDFReader
* TextFileReader
* JSONReader

There is a reader called `SimpleFileReader` that uses the file extension of the passed in file to automatically pick the right reader to use.  There is a `SimpleDirectoryReader` that reads all of the files in a directory and automatically picks the right readers to use to read each file, and is documented [here](https://docs.llamaindex.ai/en/stable/module_guides/loading/simpledirectoryreader/).

There is another reader called `LlamaParseReader` that uses a hosted service to parse uploaded files, and supports a great many file types.  Read about it [here](https://github.com/run-llama/llama_parse).

Another reader called `SimpleMongoReader` can use a passed-in MongoDB client and some filtering directives to read content from a Mongo database.

## Parsers

The parsers included in this package are:

* MarkdownNodeParser
* MetadataAwareTextSplitter
* NodeParser
* SentenceSplitter
* SentenceWindowNodeParser
* SimpleNodeParser
* TextSplitter
* splitByChar
* splitByPhraseRegex
* splitByRegex
* splitBySentenceTokenizer
* splitBySep 

Most of these parsers are documented [here](https://docs.llamaindex.ai/en/stable/module_guides/loading/node_parsers/modules/)

## The Document Object

File readers and parsers return content in the form of `Document`s.  A Document is a subclass of a `TextNode`.  These are described [here](https://docs.llamaindex.ai/en/stable/api_reference/schema/#llama_index.core.schema.TextNode).  Here is a cheat-sheet:

```text
TextNode
  constructor({ text, textTemplate, startCharIdx, endCharIdx, metadataSeparator })
  generateHash() -> str
  getContent() -> str
  setContent(str)
  getText() -> str
  type() -> "TEXT"
  getNodeInfo() -> {start: , end: }

Document extends TextNode
  type() -> "DOCUMENT"
```

After you have "parsed" a file into nodes, you can do something like:

```js
const metadata = {
    loc: split.getNodeInfo(),
    ...split.metadata
}
console.log(JSON.stringify(metadata, null, 2))
{
    "loc": {
        "start": 4,
        "end": 361,
    },
    "file_path": "/mnt/data/files/README.md",
    "file_name": "README.md"
}
```

## Dependencies

Some of the readers require external dependencies to operate.  These dependencies are listed in package.json under "optionalDependencies".  These will be installed when you "npm install" this package.  If you do not need certain readers and you want to save space, you can uninstall the dependencies you do not want.  The readers that require external dependencies dynamically load them only when they are used.
