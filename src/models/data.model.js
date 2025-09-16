import mongoose, { mongo } from "mongoose";

const metalSchema = new mongoose.Schema({
  metal: { type: String, required: true },
  values: [{ type: Number, required: true }],
});

const daySchema = new mongoose.Schema({
  date: { type: Date, required: true },
  metals: [metalSchema],
});

const siteSchema = new mongoose.Schema({
  siteArea: { type: String, required: true },
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
//   "siteArea": "Pune",
//   "siteCode": "SCP0001"
//   "location": { "lat": 18.5204, "lon": 73.8567 },
//   "tests": [
//     {
//       "date": "2025-09-16",
//       "metals": [
//         { "metal": "Pb", "values": [0.03, 0.04, 0.05] },
//         { "metal": "Zn", "values": [0.12, 0.15] }
//       ]
//     },
//     {
//       "date": "2025-09-17",
//       "metals": [
//         { "metal": "Pb", "values": [0.02, 0.03] },
//         { "metal": "Cd", "values": [0.01, 0.015] }
//       ]
//     }
//   ],
//   "createdAt": "2025-09-16T08:00:00.000Z"
// }
