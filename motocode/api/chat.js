const API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';

const commonParts = [
  'brake pad',
  'chain and sprocket',
  'air filter',
  'spark plug',
  'clutch cable',
  'electrical component',
  'fairing or body panel',
  'side mirror',
  'turn signal light',
  'headlight assembly',
  'tail light',
  'brake lever',
  'throttle grip',
  'shock absorber',
  'engine cover',
];

function cleanText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function shopLinks(query) {
  const encoded = encodeURIComponent(query);
  return [
    { label: 'Shopee', url: `https://shopee.ph/search?keyword=${encoded}`, type: 'shopee' },
    { label: 'Lazada', url: `https://www.lazada.com.ph/catalog/?q=${encoded}`, type: 'lazada' },
    { label: 'Google Shopping', url: `https://www.google.com/search?tbm=shop&q=${encoded}`, type: 'other' },
    { label: 'Carousell', url: `https://www.carousell.ph/search/${encoded}`, type: 'other' },
    { label: 'Facebook Marketplace', url: `https://www.facebook.com/marketplace/search/?query=${encoded}`, type: 'other' },
  ];
}

function fallbackResult(body) {
  const unitName = cleanText(body?.motorcycle?.unitName) || 'motorcycle';
  const yearModel = cleanText(body?.motorcycle?.yearModel);
  const selected = cleanText(body?.partCategory);
  const partName = selected && selected.toLowerCase() !== 'unknown part'
    ? selected
    : 'motorcycle replacement part';
  const searchQuery = [unitName, yearModel, partName].filter(Boolean).join(' ');
  const links = shopLinks(searchQuery);

  return {
    partName,
    description: `MotoMatch prepared online store searches for ${searchQuery}. For best fitment, compare shape, size, mounting points, and seller compatibility notes before buying.`,
    searchQuery,
    compatibility: 'Shopping links ready',
    confidence: unitName && yearModel ? 82 : 68,
    fitmentNotes: [
      'Use the exact motorcycle model and year when checking listings.',
      'Compare the old part with seller photos before checkout.',
      'Ask the seller for fitment confirmation if the listing is unclear.',
    ],
    sdgImpact: 'Supports repair and reuse by helping riders find replacement parts before discarding components.',
    shopeeUrl: links[0].url,
    lazadaUrl: links[1].url,
    otherShopLinks: links.slice(2),
    shopLinks: links,
  };
}

function parseJsonBlock(text) {
  const trimmed = cleanText(text);
  const fenced = trimmed.match(/```json\s*([\s\S]*?)```/i) || trimmed.match(/```\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : trimmed;
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
}

function normalizeResult(result, body) {
  const fallback = fallbackResult(body);
  const partName = cleanText(result?.partName || result?.part_name) || fallback.partName;
  const searchQuery = cleanText(result?.searchQuery || result?.search_query)
    || [body?.motorcycle?.unitName, body?.motorcycle?.yearModel, partName].map(cleanText).filter(Boolean).join(' ')
    || fallback.searchQuery;
  const links = shopLinks(searchQuery);

  return {
    partName,
    description: cleanText(result?.description) || fallback.description,
    searchQuery,
    compatibility: cleanText(result?.compatibility) || 'Shopping links ready',
    confidence: Math.max(1, Math.min(99, Number(result?.confidence) || fallback.confidence)),
    fitmentNotes: Array.isArray(result?.fitmentNotes) && result.fitmentNotes.length
      ? result.fitmentNotes.map(cleanText).filter(Boolean).slice(0, 5)
      : fallback.fitmentNotes,
    sdgImpact: cleanText(result?.sdgImpact || result?.sdg_impact) || fallback.sdgImpact,
    shopeeUrl: links[0].url,
    lazadaUrl: links[1].url,
    otherShopLinks: links.slice(2),
    shopLinks: links,
  };
}

async function identifyWithGemini(body) {
  if (!API_KEY) return fallbackResult(body);
  const image = cleanText(body?.image);
  if (!image) return fallbackResult(body);

  let GoogleGenerativeAI;
  try {
    ({ GoogleGenerativeAI } = require('@google/generative-ai'));
  } catch {
    return fallbackResult(body);
  }

  const genAI = new GoogleGenerativeAI(API_KEY);
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
  const unitName = cleanText(body?.motorcycle?.unitName) || 'unknown motorcycle';
  const yearModel = cleanText(body?.motorcycle?.yearModel) || 'unknown year';
  const partCategory = cleanText(body?.partCategory) || 'Unknown part';
  const mode = cleanText(body?.mode) || 'owner';

  const prompt = [
    'You are MotoMatch, a motorcycle parts shopping assistant for riders in the Philippines.',
    'Identify the visible motorcycle part from the image and create search guidance.',
    'Return only valid JSON with keys: partName, description, searchQuery, compatibility, confidence, fitmentNotes, sdgImpact.',
    `Known motorcycle: ${unitName} ${yearModel}.`,
    `Selected part category: ${partCategory}. User mode: ${mode}.`,
    `Common part guesses: ${commonParts.join(', ')}.`,
    'If unsure, choose a broad replacement-part name and lower confidence.',
    'Do not invent exact OEM part numbers unless visible in the image.',
  ].join('\n');

  const response = await model.generateContent([
    prompt,
    {
      inlineData: {
        data: image,
        mimeType: cleanText(body?.mimeType) || 'image/jpeg',
      },
    },
  ]);

  const text = response.response.text();
  return normalizeResult(parseJsonBlock(text), body);
}

module.exports = async function chatHandler(req, res) {
  try {
    const result = await identifyWithGemini(req.body || {});
    res.status(200).json({ result });
  } catch (error) {
    console.error('[MotoMatch] chat failed:', error);
    res.status(200).json({ result: fallbackResult(req.body || {}) });
  }
};
