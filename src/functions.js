import { formatLocale } from "d3-format";
import converter from './number-to-words.js';
import MagicNumber from "./magic-number.js";
import MagicObject from "./magic-object.js";

const f = formatLocale({
	"decimal": ".",
  "thousands": ",",
  "grouping": [3],
  "currency": ["£", ""]
}).format;

// Adapted from d3.autoType
export function autoType(object) {
	const fixtz = new Date("2019-01-01T00:00").getHours() || new Date("2019-07-01T00:00").getHours();
  for (var key in object) {
    var value = object[key].trim(), number, m;
    if (!value) value = null;
    else if (value === "true") value = true;
    else if (value === "false") value = false;
    else if (value === "NaN") value = NaN;
    else if (!isNaN(number = +value)) value = new MagicNumber(number);
    else if (m = value.match(/^([-+]\d{2})?\d{4}(-\d{2}(-\d{2})?)?(T\d{2}:\d{2}(:\d{2}(\.\d{3})?)?(Z|[-+]\d{2}:\d{2})?)?$/)) {
      if (fixtz && !!m[4] && !m[7]) value = value.replace(/-/g, "/").replace(/T/, " ");
      value = new Date(value);
    }
		else if (key.slice(-6) === "_array" || value.includes("|")) {
			value = value.split("|");
			if (!value[value.length - 1]) value.pop();
		}
    else continue;
    object[key] = value;
  }
  return new MagicObject(object);
}

export const abs = Math.abs;

export function round(val, dp) {
	let multiplier = Math.pow(10, -dp);
	return Math.round(val / multiplier) * multiplier;
}

export function format(val, str = ",", si = "long") {
	let dp = str.match(/-\d+(?=f)/);
	let output;
	if (dp) output = f(str.replace(`${dp}`, "0"))(round(val, dp));
	else output = f(str)(val);
	if (si === "long") output = output.replace("k", " thousand").replace("M", " million").replace("G", " billion").replace("T", " trillion");
	else output = output.replace("M", "mn").replace("G", "bn").replace("T", "tn");
	return output;
}

export function toWords(val, type = "cardinal", options = {threshold: 9, keepFirst: false}) {
	const isWords = val <= options.threshold || options.threshold === -1 || !options.threshold;
	return !options.keepFirst && val === 1 && type === "ordinal" ? "" :
		isWords && type === "ordinal" ? converter.toWordsOrdinal(val) :
		type === "ordinal" ? converter.toOrdinal(val) :
		isWords ? converter.toWords(val) :
		format(Math.floor(val));
}

export function toList (array, key, separator = [", ", " and "]) {
	const words = array.map(d => d[key]);
	return words.length < 2 ? words.join() :
		Array.isArray(separator) ?
		[
			...[words.slice(0, -1).join(separator[0])],
			...words.slice(-1)
		].join(separator[1 % separator.length]) :
		words.join(separator);
}

export function formatName(name, context = null) {
  name = name.replace("&", "and").replace(", City of", "").replace(", County of", "");
	let lc = name.toLowerCase();
  let island = lc.startsWith("isle");
  let the = [
    "north east", "north west", "east midlands", "west midlands", "east of england", "south east",
		"south west", "derbyshire dales"
  ].includes(lc) || 
    lc.startsWith("city of") || 
    lc.startsWith("vale of");
  if (["in", "the"].includes(context)) {
    if (island || the) name = "the " + name;
  }
  if (context === "in") {
    if (island) name = "on " + name;
    else name = "in " + name;
  }
  return name;
}

export function getCodeKey(obj) {
	const keys = Object.keys(obj);
	const lc = keys.map(key => key.toLowerCase());
	for (let key of ["areacd", "code", "id"]) {
		let i = lc.indexOf(key);
		if (i > -1) return keys[i];
	}
	let key = lc.find(key => key.toLowerCase().slice(-2) === "cd");
	return key ? key : keys[0];
}

export function getNameKey(obj) {
	const keys = Object.keys(obj);
	const lc = keys.map(key => key.toLowerCase());
	for (let key of ["areanm", "name", "label"]) {
		let i = lc.indexOf(key);
		if (i > -1) return keys[i];
	}
	let key = lc.find(key => key.toLowerCase().slice(-2) === "nm");
	return key ? key : keys[0];
}

export function getParentKey(obj) {
	const keys = Object.keys(obj);
	const lc = keys.map(key => key.toLowerCase());
	for (let key of ["parentcd", "parent", "regioncd", "region"]) {
		let i = lc.indexOf(key);
		console.log(i)
		if (i > -1) return keys[i];
	};
	return null;
}

export function getName(place, context = null) {
	const nameKey = getNameKey(place);
	return formatName(place[nameKey], context);
}

export function getCode(place) {
	const codeKey = getCodeKey(place);
	return place[codeKey];
}

export function getParent(place) {
	const parentKey = getParentKey(place);
	return place[parentKey];
}

export function moreLess(diff, texts = ["more", "less", "the same"]) {
	return diff > 0 ? texts[0] : diff < 0 ? texts[1] : texts[2];
}

export function capitalise(str) {
  return str[0].toUpperCase() + str.slice(1);
}