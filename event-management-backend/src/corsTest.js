// Utility to help debug CORS issues
import express from "express";
import cors from "cors";

const app = express();
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174",
  "http://127.0.0.1:8080",
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
}));

// Simple endpoint to verify the browser can hit the server under the configured CORS policy.
app.get("/test", (req, res) => {
  res.json({ message: "CORS test successful" });
});

app.listen(5050, () => {
  console.log("CORS test server running on port 5050");
});
