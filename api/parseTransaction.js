import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { input } = req.body;

  if (!input || input.trim() === '') {
    return res.status(400).json({ error: 'Input tidak boleh kosong' });
  }

  try {
    const message = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 150,
      system: `Anda adalah parser transaksi keuangan. Parse input pengguna menjadi format JSON.
Format: { "category": "kategori", "amount": number, "description": "deskripsi" }
Kategori: Makan & Minum, Transport, Kesehatan, Literasi & Buku, Langganan, Internet, Lain-lain, Pemasukan.
Jika tidak bisa parse, return error message yang jelas.`,
      messages: [
        {
          role: 'user',
          content: input
        }
      ]
    });

    const responseText = message.content[0].text;
    return res.status(200).json({ parsed: responseText });
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: error.message });
  }
}