import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export type ResumeFileType = "pdf" | "docx" | "doc" | "text";

function getExtension(fileName: string): string {
  const ext = path.extname(fileName || "").toLowerCase();
  return ext.startsWith(".") ? ext.slice(1) : ext;
}

function normalizeExtractedText(raw: string): string {
  return raw
    .replace(/\u0000/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function detectResumeFileType(fileName: string): ResumeFileType {
  const ext = getExtension(fileName);
  if (ext === "pdf") return "pdf";
  if (ext === "docx") return "docx";
  if (ext === "doc") return "doc";
  return "text";
}

export async function extractResumeText(fileName: string, fileBuffer: Buffer): Promise<{ text: string; type: ResumeFileType }> {
  const fileType = detectResumeFileType(fileName);

  if (fileType === "pdf") {
    const pdfParseModule = await import("pdf-parse") as any;
    const pdfParse = pdfParseModule.PDFParse || pdfParseModule.default || pdfParseModule;
    const pdfData = await pdfParse(fileBuffer);
    return { text: normalizeExtractedText(pdfData.text || ""), type: "pdf" };
  }

  if (fileType === "docx") {
    const mammothModule = await import("mammoth") as any;
    const mammoth = mammothModule.default || mammothModule;
    const result = await mammoth.extractRawText({ buffer: fileBuffer });
    return { text: normalizeExtractedText(result?.value || ""), type: "docx" };
  }

  if (fileType === "doc") {
    const tmpFilePath = path.join(
      os.tmpdir(),
      `resume-${Date.now()}-${Math.random().toString(36).slice(2)}.doc`
    );
    await fs.writeFile(tmpFilePath, fileBuffer);
    try {
      const extractorModule = await import("word-extractor") as any;
      const WordExtractor = extractorModule.default || extractorModule;
      const extractor = new WordExtractor();
      const extracted = await extractor.extract(tmpFilePath);
      const body = extracted?.getBody?.() || "";
      return { text: normalizeExtractedText(body), type: "doc" };
    } finally {
      await fs.unlink(tmpFilePath).catch(() => {});
    }
  }

  return {
    text: normalizeExtractedText(fileBuffer.toString("utf-8")),
    type: "text",
  };
}
