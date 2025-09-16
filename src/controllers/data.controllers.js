import multer from "multer";
import csv from "csv-parser";
import fs from "fs";

const upload = multer({ dest: "uploads/" });

export const handleUpload = [
  upload.single("file"),
  (req, res) => {
    const results = [];
    fs.createReadStream(req.file.path)
      .pipe(csv())
      .on("data", (row) => results.push(row))
      .on("end", () => {
        res.json({ message: "CSV uploaded", data: results });
      });
  },
];
