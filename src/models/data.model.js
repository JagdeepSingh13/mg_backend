import mongoose, { mongo } from "mongoose";

const metalSchema = new mongoose.Schema({
  metal: { type: String, required: true },
  values: [{ type: Number, required: true }],
});

const daySchema = new mongoose.Schema({
  date: { type: Date, required: true },
  metals: [metalSchema],
  HPI: { type: Number },
  HEI: { type: Number },
  siteInterpretation: { type: String },
  siteImpact: { type: String },
  policyRecommendations: { type: String },
});

const siteSchema = new mongoose.Schema({
  siteArea: { type: String, required: true },
  State: { type: String, required: true },
  siteCode: { type: String, required: true },
  location: {
    lat: { type: Number },
    lon: { type: Number },
  },
  tests: [daySchema],
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model("Site", siteSchema);

// {
//   "_id": "66f3a1c9b12e8f0012f45abc",
//   "siteArea": "Pune Riverbank",
//   "State": "Maharashtra",
//   "siteCode": "PN-001",
//   "location": {
//     "lat": 18.5204,
//     "lon": 73.8567
//   },
//   "tests": [
//     {
//       "date": "2025-09-01T00:00:00.000Z",
//       "metals": [
//         { "metal": "Lead", "values": [12, 15, 14] },
//         { "metal": "Cadmium", "values": [5, 6] },
//         { "metal": "Zinc", "values": [12000, 11800, 11950] }
//       ],
//       "HPI": 142.3,
//       "HEI": 7.5,
//       "siteInterpretation": "Lead and cadmium levels are consistently above ideal values, while zinc is within safe limits.",
//       "siteImpact": "Potential long-term neurological risks from lead and kidney risks from cadmium exposure.",
//       "policyRecommendations": "Increase sampling frequency, install low-cost water filters, and enforce stricter industrial discharge monitoring."
//     },
//     {
//       "date": "2025-09-10T00:00:00.000Z",
//       "metals": [
//         { "metal": "Lead", "values": [10, 12] },
//         { "metal": "Cadmium", "values": [4.5, 5] },
//         { "metal": "Zinc", "values": [11000, 11150] }
//       ],
//       "HPI": 128.6,
//       "HEI": 6.9,
//       "siteInterpretation": "Metal concentrations show slight improvement compared to earlier sampling.",
//       "siteImpact": "Health risk is slightly reduced but still above safe thresholds for lead and cadmium.",
//       "policyRecommendations": "Maintain monitoring schedule, educate local communities about water safety, and continue policy enforcement."
//     }
//   ],
//   "createdAt": "2025-09-16T14:25:30.000Z"
// }
