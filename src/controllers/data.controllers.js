import multer from "multer";
import csv from "csv-parser";
import fs from "fs";
import Site from "../models/data.model.js";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { calculateIndices } from "../utils/calcIndices.js";
import { HM_CONSTANTS } from "../utils/hpiConstants.js";
import dotenv from "dotenv";
dotenv.config();

const upload = multer({ dest: "uploads/" });

export const fetchData = async (req, res) => {
  try {
    const { siteCode } = req.params;
    console.log("Incoming siteCode:", siteCode);

    const site = await Site.findOne({ siteCode });
    if (!site) {
      return res.status(404).json({ message: "Site not found" });
    }

    if (site.tests && site.tests.length > 0) {
      // ✅ get latest test by date
      const latestTest = site.tests.reduce((latest, current) => {
        return new Date(current.date) > new Date(latest.date)
          ? current
          : latest;
      });

      // return everything + latest test (with metals, HPI, HEI, etc.)
      const response = {
        _id: site._id,
        siteArea: site.siteArea,
        State: site.State,
        siteCode: site.siteCode,
        location: site.location,
        latestTest, // contains metals + concentrations + indices
      };

      return res.json(response);
    }

    // if no tests found
    res.json({
      _id: site._id,
      siteArea: site.siteArea,
      State: site.State,
      siteCode: site.siteCode,
      location: site.location,
      latestTest: null,
    });
  } catch (error) {
    console.error("Error fetching site data:", error);
    res.status(500).json({ message: "Server Error", error });
  }
};

// Gemini setup
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
console.log("Gemini API Key:", process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

async function analyzeWithGemini(siteData, test) {
  const prompt = `
  You are an environmental analyst. Based on this site data, generate concise insights:

  Site Area: ${siteData.siteArea}
  State: ${siteData.State}
  Location: lat ${siteData.location.lat}, lon ${siteData.location.lon}
  Metals: ${test.metals.map((m) => `${m.metal}: ${m.values}`).join(", ")}
  HPI: ${test.HPI}
  HEI: ${test.HEI}

  Respond ONLY in JSON format with 3 fields:
  {
    "siteInterpretation": "2 line interpretation",
    "siteImpact": "2 line description of potential impact",
    "policyRecommendations": "2 line recommendation for policy makers"
  }
  `;

  let text = "";
  try {
    const result = await model.generateContent(prompt);
    text = result.response.text();

    // Remove markdown code fences (```json ... ```)
    text = text.replace(/```json|```/g, "").trim();

    // Try to extract JSON block if extra text is present
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      text = jsonMatch[0];
    }

    // Parse safely
    return JSON.parse(text);
  } catch (e) {
    console.error("Gemini JSON parse error:", e, "\nRaw Gemini output:", text);
    return {
      siteInterpretation: "Interpretation unavailable.",
      siteImpact: "Impact unavailable.",
      policyRecommendations: "Recommendation unavailable.",
    };
  }
}

export const uploadCSV = [
  upload.single("file"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const results = [];

      // Parse CSV
      fs.createReadStream(req.file.path)
        .pipe(csv())
        .on("data", (row) => {
          results.push(row);
        })
        .on("end", async () => {
          const processedResults = [];
          try {
            for (const row of results) {
              const {
                siteArea,
                State,
                siteCode,
                lat,
                lon,
                date,
                Pb,
                Cd,
                Zn,
                Cu,
                Ni,
                Mn,
                As,
                Cr,
              } = row;

              // Prepare metals array dynamically
              const metals = [];
              const metalMap = { Pb, Cd, Zn, Cu, Ni, Mn, As, Cr };

              for (const [metal, value] of Object.entries(metalMap)) {
                if (value && !isNaN(value)) {
                  const { S, B } = HM_CONSTANTS[metal] || {};

                  let CF = null;
                  let Igeo = null;

                  if (S) {
                    CF = Math.round((Number(value) / S) * 1000) / 1000;
                  }
                  if (B) {
                    Igeo =
                      Math.round(Math.log2(Number(value) / (1.5 * B)) * 1000) /
                      1000;
                  }

                  metals.push({
                    metal,
                    values: Number(value),
                    CF,
                    Igeo,
                  });
                }
              }

              const { HPI, HEI } = calculateIndices(metals);

              let test = {
                date: new Date(date),
                metals,
                HPI,
                HEI,
                siteInterpretation: null,
                siteImpact: null,
                policyRecommendations: null,
              };

              // Upsert site
              let site = await Site.findOne({ siteCode });

              if (!site) {
                site = new Site({
                  siteArea,
                  State,
                  siteCode,
                  location: { lat: Number(lat), lon: Number(lon) },
                  tests: [],
                });
              }

              const aiAnalysis = await analyzeWithGemini(site, test);
              test = { ...test, ...aiAnalysis };

              site.tests.push(test);
              await site.save();

              processedResults.push({
                siteArea,
                State,
                siteCode,
                lat,
                lon,
                metals,
                date,
                HPI,
                HEI,
                aiAnalysis,
              });
            }

            return res.status(200).json({
              processedResults,
              message: "CSV data uploaded successfully",
            });
          } catch (err) {
            console.error(err);
            return res.status(500).json({ error: "Error saving data to DB" });
          }
        });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  },
];

export const fetchMap = async (req, res) => {
  try {
    const sites = await Site.aggregate([
      {
        $project: {
          siteArea: 1,
          State: 1,
          siteCode: 1,
          location: 1,
          latestTest: { $arrayElemAt: ["$tests", -1] }, // get last element
        },
      },
    ]);

    res.status(200).json({ success: true, sites });
  } catch (error) {
    console.error("Error fetching data for map:", error);
    res.status(500).json({ message: "Server Error", error });
  }
};

export const siteTimeline = async (req, res) => {
  try {
    const { siteCode } = req.params;

    const site = await Site.findOne({ siteCode });

    if (!site) {
      return res
        .status(404)
        .json({ success: false, message: "Site not found" });
    }

    const tests = [...site.tests].sort(
      (a, b) => new Date(a.date) - new Date(b.date)
    );

    // Group tests year-wise
    const grouped = tests.reduce((acc, test) => {
      const yearKey = new Date(test.date).getFullYear().toString(); // "2025"
      if (!acc[yearKey]) acc[yearKey] = [];
      acc[yearKey].push({
        date: test.date,
        HPI: test.HPI,
        HEI: test.HEI,
        metals: test.metals,
      });
      return acc;
    }, {});

    res.status(200).json({
      success: true,
      site: {
        siteArea: site.siteArea,
        State: site.State,
        siteCode: site.siteCode,
        location: site.location,
      },
      timeline: grouped,
    });
  } catch (error) {
    console.error("Error fetching data for map:", error);
    res.status(500).json({ message: "Server Error", error });
  }
};
