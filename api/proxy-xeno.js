export default async function handler(request, response) {
  const { species } = request.query;

  if (!species) {
    return response.status(400).json({ error: 'Species name required' });
  }

  try {
    // 1. Search Xeno-Canto for high quality (A) recordings
    const xcResponse = await fetch(
      `https://www.xeno-canto.org/api/2/recordings?query=${encodeURIComponent(species)}+q:A`
    );
    
    const data = await xcResponse.json();
    let recordings = data.recordings || [];

    // 2. If no A quality, try B quality
    if (recordings.length === 0) {
       const fallbackResponse = await fetch(
        `https://www.xeno-canto.org/api/2/recordings?query=${encodeURIComponent(species)}+q:B`
      );
      const fallbackData = await fallbackResponse.json();
      recordings = fallbackData.recordings || [];
    }

    // 3. Still nothing? Try just the name (any quality)
    if (recordings.length === 0) {
       const lastResortResponse = await fetch(
        `https://www.xeno-canto.org/api/2/recordings?query=${encodeURIComponent(species)}`
      );
      const lastResortData = await lastResortResponse.json();
      recordings = lastResortData.recordings || [];
    }

    // 4. Return the best recording found
    const topRecording = recordings.slice(0, 1).map(rec => ({
      id: rec.id,
      url: rec.file, 
      type: rec.type,
      recordist: rec.rec,
      location: rec.loc,
      country: rec.cnt
    }));

    response.setHeader('Access-Control-Allow-Origin', '*');
    return response.status(200).json({ recordings: topRecording });

  } catch (error) {
    return response.status(500).json({ error: 'Failed to fetch sounds' });
  }
}