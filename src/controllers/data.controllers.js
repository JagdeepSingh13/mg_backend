import multer from "multer";
import csv from "csv-parser";
import fs from "fs";
import Site from "../models/data.model.js";
import { GoogleGenerativeAI } from "@google/generative-ai";



const upload = multer({ dest: "uploads/" });

// Gemini setup
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

async function analyzeWithGemini(siteData) {
  const prompt = `
  You are an environmental analyst. Based on this site data, generate concise insights:

  Site Area: ${siteData.siteArea}
  State: ${siteData.State}
  Location: lat ${siteData.location.lat}, lon ${siteData.location.lon}
  Metals: ${siteData.tests[0].metals.map(m => `${m.metal}: ${m.values[0]}`).join(", ")}
  HPI: ${siteData.tests[0].HPI}

  Respond in JSON format with 3 fields:
  {
    "siteInterpretation": "2 line interpretation",
    "siteImpact": "2 line description of potential impact",
    "policyRecommendations": "2 line recommendation for policy makers"
  }
  `;

  const result = await model.generateContent(prompt);

  try {
    return JSON.parse(result.response.text());
  } catch (e) {
    console.error("Gemini JSON parse error:", e);
    return {
      siteInterpretation: "Interpretation unavailable.",
      siteImpact: "Impact unavailable.",
      policyRecommendations: "Recommendation unavailable."
    };
  }
}

export const handleUpload = [
  upload.single("file"),
  async (req, res) => {
    try {
      const results = [];

      fs.createReadStream(req.file.path)
        .pipe(csv())
        .on("data", (row) => results.push(row))
        .on("end", async () => {
          const siteDocs = [];

          for (const row of results) {
            let siteDoc = {
              siteArea: row.landuse,
              State: "Maharashtra",
              siteCode: row.id.toString(),
              location: {
                lat: parseFloat(row.lat),
                lon: parseFloat(row.lon),
              },
              tests: [
                {
                  date: new Date(),
                  metals: [
                    { metal: "EC_uScm", values: [parseFloat(row.EC_uScm)] },
                    { metal: "TDS_mgL", values: [parseFloat(row.TDS_mgL)] },
                    { metal: "HPI_neighb", values: [parseFloat(row.HPI_neighb)] },
                    { metal: "dist_to_riv", values: [parseFloat(row.dist_to_riv)] },
                    { metal: "river_HPI", values: [parseFloat(row.river_HPI)] },
                    { metal: "industrial_HPI", values: [parseFloat(row.industrial_HPI)] },
                  ],
                  HPI: parseFloat(row.HPI),
                  HEI: null,
                  siteInterpretation: null,
                  siteImpact: null,
                  policyRecommendations: null,
                },
              ],
            };

            // 🔥 Get AI analysis
            const aiResult = await analyzeWithGemini(siteDoc);
            siteDoc.tests[0].siteInterpretation = aiResult.siteInterpretation;
            siteDoc.tests[0].siteImpact = aiResult.siteImpact;
            siteDoc.tests[0].policyRecommendations = aiResult.policyRecommendations;

            siteDocs.push(siteDoc);
          }

          await Site.insertMany(siteDocs);

          res.json({ message: "CSV uploaded & saved to DB with AI analysis", count: siteDocs.length });
        });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to process CSV" });
    }
  },
];
