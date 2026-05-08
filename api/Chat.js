module.exports = async (req, res) => {
    // 1. I-check kung POST ang request
    if (req.method !== 'POST') {
        return res.status(405).json({ error: "Method not allowed" });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    const { prompt, image } = req.body;

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ 
                    parts: [
                        { text: prompt || "Identify this motorcycle part." },
                        ...(image ? [{ inline_data: { mime_type: "image/jpeg", data: image } }] : [])
                    ] 
                }]
            })
        });

        const data = await response.json();
        res.status(200).json(data);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch from Gemini" });
    }
};