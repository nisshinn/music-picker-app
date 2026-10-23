// Spotifyは1回のリクエストで最大10件までしか返さないため、
// offsetをずらしながら必要な件数がそろうまで取得する共通関数。
//
// fetchPage(offset) は { items: [...], next: string|null } を返す関数。
// 1ページが10件未満でも、nextがある限り続ける（市場フィルタ等で件数が減るため）。
async function collectPages({
  fetchPage,
  pageSize = 10,
  maxItems = 20,
  maxPages = 5,
  accept = () => true,
  getId = (item) => item && (item.id || item.uri),
  onError = null,
}) {
  const result = [];
  const seen = new Set();
  for (let page = 0; page < maxPages && result.length < maxItems; page++) {
    let data;
    try {
      data = await fetchPage(page * pageSize);
    } catch (error) {
      if (onError) onError(error, page);
      if (error && error.status === 429) throw error; // 混雑時は呼び出し側で扱う
      break;
    }
    const items = (data && data.items) || [];
    for (const item of items) {
      if (!item || result.length >= maxItems) continue;
      if (!accept(item)) continue;
      const id = getId(item);
      if (id) {
        if (seen.has(id)) continue;
        seen.add(id);
      }
      result.push(item);
    }
    if (items.length === 0 || !data.next) break;
  }
  return result;
}

module.exports = { collectPages };
