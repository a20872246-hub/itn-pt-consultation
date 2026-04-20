require('dotenv').config();
const express = require('express');
const multer  = require('multer');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const path = require('path');

const app    = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });
const genAI  = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

app.use(express.static(path.join(__dirname)));

app.post('/api/analyze-inbody', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: '파일이 없습니다.' });

  const { mimetype, buffer } = req.file;
  const isImage = mimetype.startsWith('image/');
  const isPDF   = mimetype === 'application/pdf';

  if (!isImage && !isPDF) {
    return res.status(400).json({ error: '이미지(jpg/png) 또는 PDF 파일만 지원합니다.' });
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

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

    const imagePart = {
      inlineData: {
        data: buffer.toString('base64'),
        mimeType: mimetype,
      },
    };

    const result = await model.generateContent([prompt, imagePart]);
    const raw    = result.response.text().trim();
    const jsonStr = raw.replace(/^```json?\n?/, '').replace(/\n?```$/, '').trim();
    const data   = JSON.parse(jsonStr);

    res.json({ success: true, data });

  } catch (err) {
    console.error('Gemini API error:', err);
    res.status(500).json({ error: 'AI 분석 중 오류가 발생했습니다: ' + err.message });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`서버 실행 중: http://localhost:${PORT}`));
