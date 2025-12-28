import "dotenv/config";
import cors from "cors";
import axios from "axios";
import multer from "multer";
import express from "express";

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(
  cors({
    origin: [
      "http://localhost:5173", // Local Vite dev server
      // Vercel URL here after deployment
      "https://mcp-file-insights-chat.vercel.app",
    ],
  })
);
app.use(express.json());

// Multer config: in-memory storage (ideal for Render free tier)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "application/pdf") {
      cb(null, true);
    } else {
      cb(new Error("Only PDF files are allowed"), false);
    }
  },
});

// Health check endpoint (for UptimeRobot to keep service awake)
app.get("/health", (req, res) => res.send("OK"));

// Main query endpoint
app.post("/api/query", upload.single("pdf"), async (req, res) => {
  try {
    const { question } = req.body;

    // Validate question
    if (!question || question.trim().length === 0 || question.length > 250) {
      return res
        .status(400)
        .json({ error: "Question must be 1–250 characters" });
    }

    // Ensure a PDF was uploaded
    if (!req.file) {
      return res.status(400).json({ error: "PDF file is required" });
    }

    const pdfParse = (await import("pdf-parse")).default;

    // Extract text from the uploaded PDF buffer
    const pdfData = await pdfParse(req.file.buffer);
    // Limit context length
    const pdfText = pdfData.text.slice(0, 30000);

    // Call Groq API
    const groqRes = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        model: "llama-3.3-70b-versatile", // ← Updated here
        messages: [
          {
            role: "system",
            content:
              "You are a helpful assistant that answers questions strictly based on the provided PDF content.",
          },
          {
            role: "user",
            content: `PDF content:\n${pdfText}\n\nQuestion: ${question}`,
          },
        ],
        max_tokens: 1024,
        temperature: 0.7,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    const answer = groqRes.data.choices[0].message.content.trim();

    res.json({ success: true, answer });
  } catch (error) {
    console.error("Error:", error);

    let errorMessage = "Server error";
    if (error.response?.data?.error?.message) {
      errorMessage = error.response.data.error.message;
    } else if (error.message) {
      errorMessage = error.message;
    }

    res.status(500).json({ error: errorMessage });
  }
});

// Start server
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Backend server running on port ${PORT}`);
});
