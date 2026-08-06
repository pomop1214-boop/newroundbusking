module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'POST 요청만 가능해요' });
    return;
  }

  const { title } = req.body || {};

  if (!title || !String(title).trim()) {
    res.status(400).json({ error: '곡 제목이 필요해요' });
    return;
  }

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'YOUTUBE_API_KEY 환경 변수가 설정되지 않았어요' });
    return;
  }

  const query = String(title).trim();

  try {
    // 곡 제목만으로 검색하고, 조회수 순으로 정렬해서 가장 높은 조회수의 영상을 우선 후보로 가져와요.
    const searchUrl =
      'https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&order=viewCount&maxResults=5&q=' +
      encodeURIComponent(query) +
      '&key=' + apiKey;

    const searchRes = await fetch(searchUrl);
    const searchData = await searchRes.json();

    if (!searchRes.ok) {
      throw new Error((searchData.error && searchData.error.message) || 'YouTube 검색 요청 실패');
    }

    const ids = (searchData.items || [])
      .map((item) => item.id && item.id.videoId)
      .filter(Boolean);

    if (ids.length === 0) {
      res.status(200).json({ level: null, reason: '검색 결과를 찾지 못했어요' });
      return;
    }

    const statsUrl =
      'https://www.googleapis.com/youtube/v3/videos?part=statistics&id=' +
      ids.join(',') +
      '&key=' + apiKey;

    const statsRes = await fetch(statsUrl);
    const statsData = await statsRes.json();

    if (!statsRes.ok) {
      throw new Error((statsData.error && statsData.error.message) || 'YouTube 조회수 요청 실패');
    }

    const items = statsData.items || [];
    if (items.length === 0) {
      res.status(200).json({ level: null, reason: '조회수 정보를 찾지 못했어요' });
      return;
    }

    // 후보들 중 실제로 조회수가 가장 높은 영상을 기준으로 삼아요.
    let bestViews = 0;
    items.forEach((item) => {
      const v = parseInt((item.statistics && item.statistics.viewCount) || '0', 10);
      if (v > bestViews) bestViews = v;
    });

    let level;
    if (bestViews >= 20000000) level = '상';
    else if (bestViews < 3000000) level = '하';
    else level = '중';

    let formatted;
    if (bestViews >= 100000000) {
      formatted = (bestViews / 100000000).toFixed(1) + '억';
    } else if (bestViews >= 10000) {
      formatted = Math.round(bestViews / 10000) + '만';
    } else {
      formatted = String(bestViews);
    }

    res.status(200).json({
      level,
      reason: `유튜브 조회수 약 ${formatted}회`,
    });
  } catch (err) {
    res.status(500).json({ error: err.message || '분석 중 오류가 발생했어요' });
  }
};
