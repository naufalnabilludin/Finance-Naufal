export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { input } = req.body;
    
    if (!input) {
      return res.status(400).json({ error: 'Input required' });
    }

    // Untuk sekarang: manual parsing (tanpa AI)
    // Format: "kategori nominal" e.g. "makan 20000"
    const parts = input.trim().split(/\s+/);
    const amount = parseInt(parts[parts.length - 1]);
    const description = parts.slice(0, -1).join(' ');

    if (!amount || isNaN(amount)) {
      return res.status(400).json({ error: 'Format: kategori nominal (e.g: makan 20000)' });
    }

    res.status(200).json({ 
      parsed: JSON.stringify({
        amount,
        description: description || 'Transaksi',
        category: 'Lain-lain'
      })
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}