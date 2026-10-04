/*
 * Copyright 2026 Jason Figge
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * smart-paste.js — recognise escaped JSON and unescape it.
 *
 * APIs and logs hand JSON back as a string: "{\"id\":7,\"tags\":[\"a\"]}".
 * Two shapes are recognised:
 *
 *   quoted  "{\"a\":1}"    the whole input is one JSON string literal
 *   bare    {\"a\":1}      the same, copied without its outer quotes
 *
 * Either way it is decoded with the tokenizer's own string decoder, so the
 * escape rules are the parser's, and repeated while the result is itself
 * escaped (JSON that was escaped twice, up to MAX_LEVELS).
 *
 * Pure JS: no DOM, no jQuery. Runs in Node under `node --test`.
 */

import { decodeStringLiteral } from "./parser/tokenizer.js";

/** Stop unescaping after this many levels. */
export const MAX_LEVELS = 5;

// An escaped quote straight after an opener or a comma (whitespace allowed):
// {\"a\"  [\"x\"  ,\"b\" — the signature of escaped JSON with no outer quotes.
// One or more backslashes, so JSON escaped twice ({\\\"a\\\") is caught too.
const BARE_SIGNATURE = /[{[,]\s*\\+"/;

function isQuotedForm(t) {
  return t.length >= 2 && t[0] === '"' && t[t.length - 1] === '"';
}

function isBareForm(t) {
  return (t[0] === "{" || t[0] === "[") && BARE_SIGNATURE.test(t);
}

function tryDecode(literal) {
  try {
    return decodeStringLiteral(literal);
  } catch {
    return null;
  }
}

/**
 * @returns {{ text: string, levels: number, mode: 'quoted' | 'bare' } | null}
 *   null when the input is not escaped JSON — including a plain JSON string
 *   such as "hello", which is valid JSON as it stands and is left alone.
 */
export function detectAndUnescape(text) {
  let current = text;
  let levels = 0;
  let mode = null;

  while (levels < MAX_LEVELS) {
    const t = current.trim();
    let decoded = null;
    let shape = null;
    if (isQuotedForm(t)) {
      decoded = tryDecode(t);
      shape = "quoted";
    } else if (isBareForm(t)) {
      // Normal JSON can never get through here: its unescaped quotes end the
      // wrapped literal early, so decoding fails and the input is untouched.
      decoded = tryDecode(`"${t}"`);
      shape = "bare";
    }
    if (decoded === null) break;
    current = decoded;
    levels++;
    mode ??= shape;
  }

  if (levels === 0) return null;
  const head = current.trimStart()[0];
  if (head !== "{" && head !== "[") return null;
  return { text: current, levels, mode };
}
