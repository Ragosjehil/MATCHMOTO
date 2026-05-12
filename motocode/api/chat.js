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
  return notFoundResult('AI could not identify a specific motorcycle part from this photo. Reupload a clearer picture or type the part name, then scan again.');
}

function notFoundResult(description) {
  return {
    status: 'fail',
    partName: 'Item not found',
    description: description || 'MotoMatch could not identify the item in this photo. Reupload and scan again.',
    searchQuery: '',
    compatibility: 'Item not found',
    confidence: 0,
    fitmentNotes: [
      'Reupload a clearer, well-lit photo.',
      'Make sure the part fills most of the frame.',
      'Type the part name if you know it, then scan again.',
    ],
    sdgImpact: '',
    shopeeUrl: '',
    lazadaUrl: '',
    otherShopLinks: [],
    shopLinks: [],
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
  const confidence = Math.max(0, Math.min(99, Number(result?.confidence) || 0));
  const status = cleanText(result?.status).toLowerCase();
  const searchQuery = cleanText(result?.searchQuery || result?.search_query)
    || [body?.motorcycle?.unitName, body?.motorcycle?.yearModel, partName].map(cleanText).filter(Boolean).join(' ')
    || fallback.searchQuery;
  const nonPartPattern = /paper|document|receipt|book|notebook|page|text|letter|card|poster|screen|person|face|hand|food|bottle/i;
  const unusable = status === 'fail'
    || status === 'not_a_part'
    || status === 'not motorcycle part'
    || /not found/i.test(partName)
    || nonPartPattern.test(partName)
    || nonPartPattern.test(searchQuery)
    || !searchQuery
    || /^(unknown|unclear|part)$/i.test(partName);
  if (unusable) {
    return notFoundResult(cleanText(result?.description));
  }
  const links = shopLinks(searchQuery);

  return {
    status: 'found',
    partName,
    description: cleanText(result?.description) || fallback.description,
    searchQuery,
    compatibility: cleanText(result?.compatibility) || 'Shopping links ready',
    confidence,
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
  const unitName = cleanText(body?.motorcycle?.unitName) || 'unknown motorcycle';
  const yearModel = cleanText(body?.motorcycle?.yearModel) || 'unknown year';
  const typedPartName = cleanText(body?.typedPartName) || 'not provided';
  const partCategory = cleanText(body?.partCategory) || 'Unknown part';
  const mode = cleanText(body?.mode) || 'owner';

  const prompt = [
    'You are MotoMatch, a motorcycle parts shopping assistant for riders in the Philippines.',
    'Identify the visible motorcycle part from the image and create online-shopping search guidance.',
    'Return only valid JSON with keys: status, partName, description, searchQuery, compatibility, confidence, fitmentNotes, sdgImpact.',
    `Known motorcycle: ${unitName} ${yearModel}.`,
    `Optional typed parts name from user: ${typedPartName}.`,
    `Old selected part category, if any: ${partCategory}. User mode: ${mode}.`,
    `Common part guesses: ${commonParts.join(', ')}.`,
    'Use the typed parts name as an optional hint when provided, but rely on the image and correct it if the image clearly shows a different part.',
    'If any motorcycle part or likely replacement part is visible, ALWAYS set status to found and give the best specific part name you can infer, even when the photo is blurry, cropped, dark, or partially blocked.',
    'Never return a generic partName like unknown, unclear, part, or motorcycle part when any visible shape can support a practical guess.',
    'If the photo shows paper, a document, text, receipt, notebook, card, person, food, or any non-motorcycle object, set status to fail and partName to Item not found.',
    'Build searchQuery for Shopee Philippines: motorcycle brand/model/year + precise part name + useful visible variant such as left/right, front/rear, color, assembly, cable, lever, cover, fairing, or light when visible.',
    'Keep searchQuery short enough for Shopee and Lazada search boxes.',
    'In fitmentNotes, tell the user what to compare in seller listings: mounting holes, plug/socket, side, shape, size, color, part code, and model-year compatibility.',
    'Only use status fail when the photo has no visible object, is unreadable, or clearly does not show a motorcycle/replacement part.',
    'Do not invent OEM part numbers unless visible in the image.',
  ].join('\n');

  const modelNames = ['gemini-1.5-pro', 'gemini-1.5-flash'];
  let lastError = null;
  for (const modelName of modelNames) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
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
    } catch (error) {
      lastError = error;
      console.warn(`[MotoMatch] ${modelName} failed:`, error?.message || error);
    }
  }

  if (lastError) {
    throw lastError;
  }

  return fallbackResult(body);
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
