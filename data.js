// import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";
// import pako from 'https://cdn.jsdelivr.net/npm/pako@2.0.4/+esm';
// async function loadGzippedJson(url) {
//     try {
//         const response = await fetch(url);
//         if (!response.ok) {
//             throw new Error(`HTTP error! Status: ${response.status}`);
//         }
// 
//         const arrayBuffer = await response.arrayBuffer();
//         const decompressedData = pako.inflate(new Uint8Array(arrayBuffer), { to: 'string' });
//         const jsonData = JSON.parse(decompressedData);
// 
//         return jsonData;
//     } catch (error) {
//         console.error('Error loading gzipped JSON:', error);
//     }
// }
//export const data = await d3.json("test.json.gz");
//export const data = await loadGzippedJson("test.json.gz");
