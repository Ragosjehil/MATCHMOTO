const { GoogleGenerativeAI } = require("@google/generative-ai");

module.exports = async (req, res) => {
  // Payagan ang frontend na maka-access (CORS)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { image } = req.body;
    if (!image) {
      return res.status(400).json({ error: "No image provided" });
    }

    // Kunin ang API Key mula sa Environment Variable ng Vercel
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "API Key missing in server settings" });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    // Gamitin ang gemini-1.5-flash dahil ito ang pinaka-stable sa free tier
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = "Identify this motorcycle part and give a brief description of its function.";
    
    const imageParts = [
      {
        inlineData: {
          data: image,
          mimeType: "image/jpeg"
        }
      }
    ];

    const result = await model.generateContent([prompt, ...imageParts]);
    const response = await result.response;
    const text = response.text();

    return res.status(200).json({ text });
  } catch (error) {
    console.error("API Error:", error);
    return res.status(500).json({ error: error.message });
  }
};