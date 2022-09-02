import axios from "axios";
import { JSDOM } from "jsdom";
import JSZip from "jszip";
import * as fs from "fs";

if (process.argv.length != 3) {
  console.error("Missing URL argument");
  process.exit();
}

let url = process.argv[2];

let resp = await axios.get(url);
let dom = new JSDOM(resp.data);

let input = dom.window.document.querySelector("#assetUrl");
let opfUrl = input.getAttribute("value");

console.log(`Downloading OPF at ${opfUrl}`);

let baseUrl = opfUrl.substring(0, opfUrl.lastIndexOf("/"));

let opfResp = await axios.get(opfUrl);
let opfData = opfResp.data;

let zip = new JSZip();
zip.file("content.opf", opfData);

let domParser = new dom.window.DOMParser();

const opfDoc = domParser.parseFromString(opfData, "text/xml");

let itemList = opfDoc.querySelectorAll("item");

let fileProms = Array.from(itemList)
  .map((x) => x.getAttribute("href"))
  .map((x) =>
    axios
      .get(`${baseUrl}/${x}`, { responseType: "arraybuffer" })
      .then((resp) => ({
        data: resp.data,
        path: x,
      }))
  );

let datas = await Promise.all(fileProms);
console.log(`Downloaded ${fileProms.length} files`);

for (let data of datas) {
  zip.file(data.path, data.data);
}

await new Promise((resolve) => {
  zip
    .generateNodeStream({ type: "nodebuffer", streamFiles: true })
    .pipe(fs.createWriteStream("book.epub"))
    .on("finish", () => resolve());
});

console.log("Output has been generated");
