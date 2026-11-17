import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '25mb' }));

// Setup Google GenAI client if GEMINI_API_KEY is available
let ai: GoogleGenAI | null = null;
if (process.env.GEMINI_API_KEY) {
  ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// OCR and Lab Report Extraction Endpoint
app.post('/api/ocr/extract', async (req, res) => {
  try {
    const { fileData, mimeType, fileName } = req.body;

    if (!fileData || !mimeType) {
      return res.status(400).json({
        success: false,
        error: 'Missing fileData or mimeType in request payload.',
      });
    }

    if (!ai) {
      // Return a structured response indicating Gemini API key is missing or we can use fallback heuristic extraction
      return res.status(200).json({
        success: true,
        extractedParameters: [],
        rawText: `[Report: ${fileName || 'laboratory_report'}]\nDocument received. GEMINI_API_KEY is not configured in the environment for automatic extraction; please use manual laboratory entry.`,
        confidence: 'low',
        notes: 'API key not configured on server. Manual entry available.',
      });
    }

    const prompt = `You are a specialized medical laboratory report extraction system for Redora.
Analyze the provided medical laboratory report (image or PDF). Extract all blood test and hematology / biochemistry parameters found.

For each parameter extracted, return:
- id: standard identifier (e.g., "hb", "hct", "rbc", "mcv", "mch", "mchc", "rdw", "wbc", "plt", "ferritin", "iron", "tibc", "tsat", "b12", "folate", "reticulocytes", "crp", "creatinine", "egfr", "ldh", "bilirubin_total", "bilirubin_indirect", "haptoglobin", "hb_electrophoresis")
- nameAr: Standard English laboratory name (e.g., "Hemoglobin", "MCV", "Ferritin", "Vitamin B12")
- nameEn: Standard English name and abbreviation (e.g., "Hemoglobin (Hb)", "Mean Corpuscular Volume (MCV)", "Ferritin", "Vitamin B12")
- value: numeric value as a number if possible, or string if qualitative (e.g., 10.2, 72, 18)
- unit: original unit extracted from report without converting (e.g., "g/dL", "g/L", "fL", "pg", "%", "ng/mL", "pmol/L", "pg/mL", "million/µL", "x10^12/L")
- refRangeLow: lower normal limit if printed in report, otherwise null
- refRangeHigh: upper normal limit if printed in report, otherwise null
- refRangeRaw: verbatim reference range printed on report (e.g., "12.0 - 16.0", "15 - 150")
- flag: "low" | "normal" | "high" | "unknown" (relative to report reference range)
- confidence: "high" | "medium" | "low" (flag "low" if blurred, handwritten or ambiguous)
- isAmbiguous: boolean
- ambiguityReason: string or null if not ambiguous

Also return:
- rawTextSummary: a brief transcript of the recognized text
- reportDate: string date of test if found on the report, or null
- patientSex: detected sex if stated on report ("male" | "female" | null)
- duplicatesDetected: array of duplicate parameters if any

Never guess unreadable numbers. If a number is unclear, set confidence to "low" and isAmbiguous to true.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: [
        {
          parts: [
            {
              inlineData: {
                data: fileData,
                mimeType: mimeType,
              },
            },
            {
              text: prompt,
            },
          ],
        },
      ],
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            parameters: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  nameAr: { type: Type.STRING },
                  nameEn: { type: Type.STRING },
                  value: { type: Type.NUMBER },
                  unit: { type: Type.STRING },
                  refRangeLow: { type: Type.NUMBER },
                  refRangeHigh: { type: Type.NUMBER },
                  refRangeRaw: { type: Type.STRING },
                  flag: { type: Type.STRING },
                  confidence: { type: Type.STRING },
                  isAmbiguous: { type: Type.BOOLEAN },
                  ambiguityReason: { type: Type.STRING },
                },
                required: ['id', 'nameAr', 'nameEn', 'value', 'unit'],
              },
            },
            rawTextSummary: { type: Type.STRING },
            reportDate: { type: Type.STRING },
            patientSex: { type: Type.STRING },
            duplicatesDetected: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
          },
          required: ['parameters', 'rawTextSummary'],
        },
      },
    });

    const parsed = JSON.parse(response.text || '{}');

    return res.json({
      success: true,
      extractedParameters: parsed.parameters || [],
      rawText: parsed.rawTextSummary || '',
      reportDate: parsed.reportDate || null,
      patientSex: parsed.patientSex || null,
      duplicatesDetected: parsed.duplicatesDetected || [],
    });
  } catch (error: any) {
    console.error('OCR Extraction Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to process document with OCR engine.',
    });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    appName: 'Redora Medical Expert System',
    geminiConfigured: !!ai,
    timestamp: new Date().toISOString(),
  });
});

async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, () => {
    console.log(`Redora server running on port ${PORT} (NODE_ENV: ${process.env.NODE_ENV || 'development'})`);
  });
}

startServer();
