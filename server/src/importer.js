'use strict';
// Turns an uploaded file into editor HTML. Supported: .txt, .md, .docx
const path = require('node:path');

const SUPPORTED = ['.txt', '.md', '.docx'];
const escapeHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function txtToHtml(text) {
  return text
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

/**
 * @param {{originalname: string, buffer: Buffer}} file
 * @param {{marked?: Function, mammoth?: object}} deps injected so the function is testable
 * @returns {Promise<{title: string, html: string}>}
 */
async function importFile(file, { marked, mammoth } = {}) {
  const ext = path.extname(file.originalname || '').toLowerCase();
  if (!SUPPORTED.includes(ext)) {
    const err = new Error(`Unsupported file type "${ext || 'unknown'}". Supported: ${SUPPORTED.join(', ')}`);
    err.status = 415;
    throw err;
  }
  const title = path.basename(file.originalname, ext).slice(0, 200) || 'Imported document';
  let html;
  if (ext === '.txt') html = txtToHtml(file.buffer.toString('utf8'));
  else if (ext === '.md') html = marked.parse(file.buffer.toString('utf8'));
  else html = (await mammoth.convertToHtml({ buffer: file.buffer })).value;
  return { title, html: html || '<p></p>' };
}

module.exports = { importFile, SUPPORTED, txtToHtml };
