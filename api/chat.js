// api/chat.js
// Deploy this as a Vercel Serverless Function (or Netlify Function with minor tweaks).
// The API key lives ONLY here, on the server — never in your frontend JS.
//
// Uses Google's Gemini API (gemini-2.5-flash), which has an ongoing free tier —
// no credit card, no trial expiry, just a daily/per-minute rate limit.
//
// Setup:
// 1. Put this file in a repo with a `/api` folder at the root (Vercel auto-detects it).
// 2. Get a free key at https://aistudio.google.com/apikey (no credit card needed).
// 3. In Vercel dashboard -> Project -> Settings -> Environment Variables, add:
//      GEMINI_API_KEY = your_real_key_here
// 4. Deploy. Vercel gives you a URL like https://your-project.vercel.app
// 5. Your GitHub Pages site calls https://your-project.vercel.app/api/chat

// --- Edit this to match your real profile info ---
const PROFILE_CONTEXT = `
Kamu adalah asisten chat di situs portofolio Ahmad Sabili Alghifari, seorang Web
Developer berbasis di Tangerang, Indonesia. Kamu boleh menjawab pertanyaan apa
saja secara bebas dan natural — bukan cuma soal Ahmad, tapi juga pertanyaan
umum, obrolan santai, atau pertanyaan teknis soal web development, dll.

Kalau ditanya soal Ahmad secara spesifik, gunakan data berikut sebagai sumber
utama (jangan mengarang detail yang tidak ada di sini):

PENGALAMAN KERJA:
- PT. Jadin Pratama (Sep 2025 - sekarang), Web Developer: PHP (CodeIgniter, Laravel),
  Node.js, PostgreSQL, JavaScript (jQuery, Ajax), HTML, CSS, Bootstrap, MySQL, SQL Server.
- PT. Shan Information System (Agu 2024 - Agu 2025), Web Developer: sistem ERP & Akuntansi
  berbasis web, PHP (CodeIgniter), JavaScript, MySQL, SQL Server.
- Reach U Solutions (Des 2023 - Feb 2024), Magang Web Developer: belajar HMVC.
- PT. Ardiona Sinergi Kreatif (Okt 2021 - Des 2021), Magang Front-End Developer:
  UI ke kode, animasi, CSS BEM methodology.

SKILL: Front-End (React, JS, HTML/CSS) 90%, Back-End (PHP, Laravel, CodeIgniter) 80%,
Database (MySQL, SQL Server) 75%, Motion & Interaksi (GSAP) 70%.

PENDIDIKAN: Lulusan Sistem Informasi.

Total pengalaman kerja profesional (di luar magang): sekitar 2 tahun di posisi Web Developer
penuh (Jadin Pratama + Shan Information System), plus pengalaman magang sebelumnya.

Kalau ditanya soal Ahmad tapi datanya tidak ada di atas (misal hobi, tanggal
lahir, dsb), jawab jujur bahwa kamu tidak punya info itu dan sarankan
menghubungi langsung lewat email ahmadsabili0081@gmail.com — jangan mengarang.

Untuk pertanyaan di luar topik Ahmad, jawab senormal mungkin seperti asisten
AI pada umumnya. Tetap ramah, jawab ringkas (idealnya 2-5 kalimat kecuali
pertanyaannya memang butuh penjelasan lebih panjang, misal soal teknis/kode).
`;

export default async function handler(req, res) {
  // CORS: allow your GitHub Pages origin to call this endpoint
  res.setHeader('Access-Control-Allow-Origin', '*'); // tighten to your exact domain in production
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { message, history } = req.body || {};
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Missing "message" field' });
    }

    // Keep only the last few turns to control latency / staying under rate limits
    const trimmedHistory = Array.isArray(history) ? history.slice(-6) : [];

    // Gemini's "contents" format uses role "model" instead of "assistant",
    // and each turn's text goes inside a "parts" array.
    const geminiHistory = trimmedHistory.map((turn) => ({
      role: turn.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: turn.content }],
    }));

    const model = 'gemini-2.5-flash-lite'; // stable, free-tier eligible, good for a Q&A widget
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': process.env.GEMINI_API_KEY,
      },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: PROFILE_CONTEXT }] },
        contents: [...geminiHistory, { role: 'user', parts: [{ text: message }] }],
        generationConfig: { maxOutputTokens: 500 },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Gemini API error:', errText);
      // 429 here usually means the free-tier rate limit was hit
      return res.status(502).json({ error: 'Upstream API error' + `${errText}` });
    }

    const data = await response.json();
    const reply =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      'Maaf, aku belum bisa jawab itu sekarang.';

    return res.status(200).json({ reply });
  } catch (err) {
    console.error('Chat handler error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
