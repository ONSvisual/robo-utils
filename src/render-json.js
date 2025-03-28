import * as parser from "node-html-parser";
import parseColor from "parse-color";
import * as functions from "./functions.js";
import MagicArray from "./magic-array.js";

const parse = parser?.default?.parse ? parser.default.parse :
  parser?.parse ? parser.parse : parser;

const unescapeHTML = (escaped) => escaped
  .replace(/&amp;/g, "&")
  .replace(/&lt;/g, "<")
  .replace(/&gt;/g, ">")
  .replace(/&quot;/g, "\"")
  .replace(/&#039;/g, "'")
  .replace(/&lt;/g, "<")
  .replace(/&gt;/g, ">")
  .replace(/(?<=\d.)\s(?=\d)/g, "");

// Cycle through LAs (and null for "no area selected")
export default function renderJSON(template, place, places, lookup, pug = window.pug) {
  // Arrays to hold content
  const sections = [];
  const notes = [];

  // Error message for invalid outputs (where pug renderer has thrown an error)
  let error;

  try {
    // Fix .toData() functions
    let funcs = template.match(/(?<=\.toData\().*?((?=\)\r\n)|(?=\)\n))/g);
    if (Array.isArray(funcs)) {
      funcs = Array.from(new Set(funcs));
      funcs.forEach(f => template = template.replaceAll(f, `${f}, "stringify"`));
    }

    // Render PUG template with data for selected LA
    let sections_raw = pug.render(template, {
      place,
      places,
      row: place,
      rows: places,
      lookup,
      ...functions,
      MagicArray,
      language: "en_US",
    });
    // Fix to remove spaces added between numbers and prefix/suffix symbols by Rosae
    sections_raw = sections_raw.replace(/(?<=\d)\s+((?=%)|(?=p{2}))/g, "");
    sections_raw = sections_raw.replace(/(?<=[£€\$])\s+(?=\d)/g, "");
    // Fix to add spaces after closing </mark> </em> or <strong> tags unless followed by one of . , <
    sections_raw = sections_raw.replace(
      /((?<=<\/span>)|(?<=<\/mark>)|(?<=<\/strong>)|(?<=<\/em>)|(?<=<\/[abi]>))(?![\.,<:;])/g,
      " "
    );

    // Process <mark> tags for text colour contrast
    // This might be better handled in the HTML parser
    let marks = sections_raw.match(/<mark([^<]*?)>/g);
    if (Array.isArray(marks)) {
      marks = marks.filter(
        (d, i, arr) => arr.indexOf(d) == i && d.includes("background-color")
      );
      if (marks[0]) {
        let colors = marks.map(
          (d) => d.match(/(?<=background-color:\s).+(?=[";])/)[0]
        );
        colors.forEach((color) => {
          let rgb = parseColor(color).rgb;
          let text_color =
            (rgb[0] * 299 + rgb[1] * 587 + rgb[2] * 114) / 1000 > 125
              ? "black"
              : "white";
          sections_raw = sections_raw.replaceAll(
            `background-color: ${color}`,
            `background-color: ${color}; color: ${text_color};`
          );
        });
      }
    }

    // Process HTML output of Pug into structured JSON
    let root = parse(sections_raw); // Convert HTML string into DOM-type object for parsing

    function parseSection(node) {
      let obj = {};
      if (node.getAttribute("id")) obj.id = node.getAttribute("id");
      if (node.getAttribute("class")) obj.type = node.getAttribute("class");
      let content = "";
      let subsections = [];

      // Loop through children (h2, p, subsections etc)
      node.childNodes.forEach((child) => {
        if (child.tagName == "SECTION") {
          subsections.push(child);
        } else if (child.tagName == "PROP" && child.getAttribute("class")) {
          let prop = child.getAttribute("class");
          if (prop === "data") {
            obj[prop] = JSON.parse(unescapeHTML(child.innerText));
          } else {
            let val = child.innerText.includes("|") ?
              child.innerText.split("|") :
              child.innerHTML;
            obj[prop] = val;
          }
        } else {
          content += child.outerHTML;
        }
      });
      if (content.length > 0) obj.content = content;

      // If there are sub-sections (eg. for scrollers), process these similarly sections
      // This could probably better be done recursively
      if (subsections[0]) {
        obj.sections = [];
        subsections.forEach((sub) => {
          obj.sections.push(parseSection(sub));
        })
      }
      return obj;
    }

    // Loop through main sections in the DOM and push them to the sections array
    if (root.childNodes.find(child => child.getAttribute && child.tagName !== "SECTION")) {
      // If the document is not structured in sections
      sections.push(parseSection(root));
    } else {
      root.childNodes.filter(child => child.getAttribute).forEach((node) => {
        sections.push(parseSection(node));
      });
    }

    // Push any top level HTML comments to the notes array
    root.childNodes.filter(child => !child.getAttribute).forEach((node) => {
      notes.push(node._rawText.replaceAll("<! --", "").replaceAll("-->", ""));
    });
  }
  catch (err) {
    error = err.toString();
    console.warn(`PUG error. No HTML generated for ${place ? place.getName("the") : `no area selected`}`, err);
  }

  // Build the data object to be saved to JSON
  const data = { sections };
  if (place) data.place = place;
  if (place && lookup[place.getParent()])
    data.region = lookup[place.getParent()];
  if (place && lookup[place.getCountry()])
    data.ctry = lookup[place.getCountry()];
  if (notes[0]) data.notes = notes;
  if (error) data.error = error;

  return data;
}
