import dotenv from "dotenv";
import multer from "multer";
import csv from "csv-parser";
import fs from "fs";
import Site from "../models/data.model.js";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { calculateIndices } from "../utils/calcIndices.js";
import { HM_CONSTANTS } from "../utils/hpiConstants.js";
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
      // or change to last entry
      const latestTest = site.tests[site.tests.length - 1];

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

// Gemini setup (use env var if provided, otherwise fallback to built-in key)
const GEMINI_API_KEY =
  process.env.GEMINI_API_KEY ||
  process.env.GOOGLE_API_KEY ||
  "AIzaSyB-0X1YdbCDLc3_1VdkUdncj2jT9ex8Wws";
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

function withTimeout(promise, ms, onTimeoutMessage = "AI request timed out") {
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error(onTimeoutMessage)), ms)
  );
  return Promise.race([promise, timeout]);
}

async function analyzeWithGemini(siteData, test) {
  const metalsList = ["Pb", "Cd", "Zn", "Cu", "Ni", "Mn", "As", "Cr"];

  const prompt = `
  You are an environmental analyst. Based on this site data, generate concise insights and numeric future predictions:

  Site Area: ${siteData.siteArea}
  State: ${siteData.State}
  Location: lat ${siteData.location.lat}, lon ${siteData.location.lon}
  Date: ${test.date}
  Metals (mg/L): 
  ${test.metals.map((m) => `${m.metal}: ${m.values}`).join(", ")}
  HPI: ${test.HPI}
  HEI: ${test.HEI}

  Respond ONLY in JSON format with this structure:
  {
    "siteInterpretation": "2 line interpretation",
    "siteImpact": "2 line description of potential impact",
    "policyRecommendations": "3.5 line recommendation for policy makers",
    "baselinePrediction": " a plain string with all the predicted values of all metals assuming the recommended policies are applied effectively",
    "withPolicyPrediction": "a plain string with all the values of metals",
    "effectOfPolicy": "2 lines explaining how policies could change metal concentrations and risks"
  }

  Rules:
  - BaselinePrediction = extrapolated numeric values based only on current data, assuming no policies are applied.
  - WithPolicyPrediction = numeric values assuming the recommended policies are applied effectively.
  - Predictions must always include ALL metals (Pb, Cd, Zn, Cu, Ni, Mn, As, Cr) even if their current value is missing.
  - Predictions must be numeric (no text like 'slight increase').
  - Keep predictions realistic: within ±20% of current values unless strong justification.
  `;

  let text = "";
  try {
    const result = await withTimeout(model.generateContent(prompt), 40000);
    text = result.response.text();

    // Clean JSON
    text = text.replace(/```json|```/g, "").trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) text = jsonMatch[0];

    return JSON.parse(text);
  } catch (e) {
    console.error("Gemini JSON parse error:", e, "\nRaw Gemini output:", text);
    return {
      siteInterpretation: "Interpretation unavailable.",
      siteImpact: "Impact unavailable.",
      policyRecommendations: "Recommendation unavailable.",
      baselinePrediction: "baselinePrediction unavailable",
      withPolicyPrediction: "withPolicyPrediction unavailable",
      effectOfPolicy: "Unavailable.",
    };
  }
}

// Gemini index findings for metals
async function analyzeIndicesWithGemini(siteData, test) {
  const prompt = `
  You are an environmental analyst. Given the following metal indices for a site, generate concise findings:

  Metals:
  ${test.metals
    .map(
      (m) => `${m.metal}: Igeo=${m.Igeo}, CF=${m.CF}, EF=${m.EF}, ERI=${m.ERI}`
    )
    .join("\n")}

  Respond ONLY in JSON format with four fields:
  {
    "igeo_Finding": "Brief interpretation of Igeo values",
    "cf_Finding": "Brief interpretation of CF values",
    "ef_Finding": "Brief interpretation of EF values",
    "eri_Finding": "Brief interpretation of ERI values"
  }
  `;

  if (!model) {
    return {
      igeo_Finding: "Interpretation unavailable",
      cf_Finding: "Interpretation unavailable",
      ef_Finding: "Interpretation unavailable",
      eri_Finding: "Interpretation unavailable",
    };
  }

  let text = "";
  try {
    const result = await withTimeout(model.generateContent(prompt), 30000);
    text = result.response.text();
    text = text.replace(/```json|```/g, "").trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) text = jsonMatch[0];
    return JSON.parse(text);
  } catch (e) {
    console.error(
      "Gemini index findings parse error:",
      e,
      "\nRaw Gemini output:",
      text
    );
    return {
      igeo_Finding: "Interpretation unavailable",
      cf_Finding: "Interpretation unavailable",
      ef_Finding: "Interpretation unavailable",
      eri_Finding: "Interpretation unavailable",
    };
  }
}

export const uploadCSVRaw = [
  upload.single("file"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const results = [];

      fs.createReadStream(req.file.path)
        .pipe(csv())
        .on("data", (row) => results.push(row))
        .on("end", async () => {
          const data = [];
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
                season,
              } = row;

              // Prepare metals
              const metals = [];
              const metalMap = { Pb, Cd, Zn, Cu, Ni, Mn, As, Cr };

              for (const [metal, value] of Object.entries(metalMap)) {
                if (value && !isNaN(value)) {
                  const { S, B } = HM_CONSTANTS[metal] || {};

                  let CF = null;
                  let Igeo = null;
                  let EF = null;
                  let ERI = null;

                  if (S) CF = +(Number(value) / S).toFixed(3);
                  if (B) {
                    Igeo = +Math.log2(Number(value) / (1.5 * B)).toFixed(3);
                    EF = +(Number(value) / B).toFixed(3);
                  }
                  if (CF !== null) ERI = +(CF * Number(value)).toFixed(3);

                  metals.push({
                    metal,
                    values: Number(value),
                    CF,
                    Igeo,
                    EF,
                    ERI,
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
                season,
              };

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

              site.tests.push(test);
              await site.save();

              data.push({
                siteArea,
                State,
                siteCode,
                lat,
                lon,
                metals,
                date,
                HPI,
                HEI,
                season,
              });
            }

            return res.status(200).json({
              data,
              message: "CSV data uploaded successfully (raw, no AI)",
            });
          } catch (err) {
            console.error(err);
            return res.status(500).json({ error: "Error saving raw data" });
          }
        });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  },
];

export const generateAIInsights = async (req, res) => {
  try {
    const { siteCode } = req.params;

    const site = await Site.findOne({ siteCode });
    if (!site) {
      return res.status(404).json({ error: "Site not found" });
    }

    // Get latest test
    // not latest test but the the test just uploaded
    // const latestTest = site.tests.sort(
    //   (a, b) => new Date(b.date) - new Date(a.date)
    // )[0];
    const latestTest = site.tests[site.tests.length - 1];

    if (!latestTest) {
      return res
        .status(400)
        .json({ error: "No tests available for this site" });
    }

    // Run Gemini on existing data (only if model configured)
    let aiAnalysis = {
      siteInterpretation: null,
      siteImpact: null,
      policyRecommendations: null,
      baselinePrediction: null,
      withPolicyPrediction: null,
      effectOfPolicy: null,
    };
    let indexFindings = null;
    if (model) {
      aiAnalysis = await analyzeWithGemini(site, latestTest);
      indexFindings = await analyzeIndicesWithGemini(site, latestTest);
    }

    // Update main AI insights
    latestTest.siteInterpretation = aiAnalysis.siteInterpretation;
    latestTest.siteImpact = aiAnalysis.siteImpact;
    latestTest.policyRecommendations = aiAnalysis.policyRecommendations;
    latestTest.baselinePrediction = aiAnalysis.baselinePrediction;
    latestTest.withPolicyPrediction = aiAnalysis.withPolicyPrediction;
    latestTest.effectOfPolicy = aiAnalysis.effectOfPolicy;

    // Save index findings into schema fields
    if (indexFindings) {
      latestTest.igeo_Finding = indexFindings.igeo_Finding;
      latestTest.cf_Finding = indexFindings.cf_Finding;
      latestTest.ef_Finding = indexFindings.ef_Finding;
      latestTest.eri_Finding = indexFindings.eri_Finding;
    }

    await site.save();

    res.status(200).json({
      message: "AI insights generated successfully",
      siteCode,
      aidata: latestTest,
    });
  } catch (error) {
    console.error("Error generating AI insights:", error);
    res.status(500).json({ error: "Server error" });
  }
};

export const fetchMap = async (req, res) => {
  try {
    const { state } = req.params;

    const sites = await Site.aggregate([
      {
        $match: { State: state }, // filter by State field
      },
      {
        $project: {
          siteArea: 1,
          State: 1,
          siteCode: 1,
          location: 1,
          latestTest: { $arrayElemAt: ["$tests", -1] }, // last test in array
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

export const getOverview = async (req, res) => {
  try {
    const sites = await Site.aggregate([
      // Flatten tests to handle individually
      { $unwind: "$tests" },
      // Sort by date desc
      { $sort: { "tests.date": -1 } },
      // Group back to keep only latest test per site
      {
        $group: {
          _id: "$_id",
          siteArea: { $first: "$siteArea" },
          State: { $first: "$State" },
          siteCode: { $first: "$siteCode" },
          location: { $first: "$location" },
          latestTest: { $first: "$tests" },
        },
      },
      // Categorize into risk levels
      {
        $addFields: {
          riskLevel: {
            $switch: {
              branches: [
                { case: { $lt: ["$latestTest.HPI", 50] }, then: "Low" },
                {
                  case: {
                    $and: [
                      { $gte: ["$latestTest.HPI", 50] },
                      { $lt: ["$latestTest.HPI", 100] },
                    ],
                  },
                  then: "Medium",
                },
                { case: { $gte: ["$latestTest.HPI", 100] }, then: "High" },
              ],
              default: "Unknown",
            },
          },
        },
      },
      // Group by riskLevel
      {
        $group: {
          _id: "$riskLevel",
          count: { $sum: 1 },
          sites: {
            $push: {
              siteCode: "$siteCode",
              siteArea: "$siteArea",
              State: "$State",
              location: "$location",
              latestHPI: "$latestTest.HPI",
            },
          },
        },
      },
    ]);

    res.status(200).json({ success: true, riskSummary: sites });
  } catch (error) {
    console.error("Error fetching HPI risk summary:", error);
    res.status(500).json({ message: "Server Error", error });
  }
};
