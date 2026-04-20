const multer  = require('multer');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

const prompt = `이 인바디(체성분분석) 결과지에서 다음 항목들을 추출해서 JSON으로만 응답해줘. 없는 값은 null로 처리해.

{
  "weight": 체중(kg, 숫자),
  "muscle": 골격근량(kg, 숫자),
  "fat": 체지방량(kg, 숫자),
  "fatPercent": 체지방률(%, 숫자),
  "bmi": BMI(숫자),
  "bmr": 기초대사량(kcal, 숫자),
  "whr": 복부지방률 또는 WHR(숫자),
  "water": 체수분(L, 숫자),
  "height": 신장(cm, 숫자),
  "age": 나이(숫자),
  "gender": "male" 또는 "female",
  "name": 이름(문자열)
}

JSON 외에 다른 텍스트는 절대 포함하지 마.`;

function runMiddleware(req, res, fn) {
  return new Promise((resolve, reject) => {
    fn(req, res, (result) => {
      if (result instanceof Error) return reject(result);
      return resolve(result);
    });
  });
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  await runMiddleware(req, res, upload.single('file'));

  if (!req.file) return res.status(400).json({ error: '파일이 없습니다.' });

  const apiKey = req.headers['x-api-key'] || process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(400).json({ error: 'API 키가 없습니다. 설정에서 Gemini API 키를 입력해주세요.' });

  const { mimetype, buffer } = req.file;
  if (!mimetype.startsWith('image/') && mimetype !== 'application/pdf') {
    return res.status(400).json({ error: '이미지(jpg/png) 또는 PDF 파일만 지원합니다.' });
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const result = await model.generateContent([
      prompt,
      { inlineData: { data: buffer.toString('base64'), mimeType: mimetype } },
    ]);
    const raw     = result.response.text().trim();
    const jsonStr = raw.replace(/^```json?\n?/, '').replace(/\n?```$/, '').trim();
    const data    = JSON.parse(jsonStr);
    res.json({ success: true, data });
  } catch (err) {
    console.error('Gemini API error:', err);
    res.status(500).json({ error: 'AI 분석 중 오류가 발생했습니다: ' + err.message });
  }
};
