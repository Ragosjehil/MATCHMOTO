const { GoogleGenerativeAI } = require("@google/generative-ai");

module.exports = async (req, res) => {
  // Payagan ang CORS para sa iyong frontend
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { image } = req.body;
    if (!image) {
      return res.status(400).json({ error: "Walang image na natanggap." });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "API Key is missing sa Vercel settings." });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    // Gamitin ang 1.5-flash dahil ito ang pinaka-stable para sa libreng tier
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // Linisin ang base64 data kung mayroon itong prefix
    const base64Data = image.includes("base64,") ? image.split("base64,")[1] : image;

    const result = await model.generateContent([
      "Identify this motorcycle part and give a brief description of its function.",
      {
        inlineData: {
          data: base64Data,
          mimeType: "image/jpeg"
        }
      }
    ]);

    const response = await result.response;
    return res.status(200).json({ text: response.text() });

  } catch (error) {
    console.error("API Error:", error);
    return res.status(500).json({ error: error.message });
  }
};