async function collectPages({ maxItems = Infinity, accept = () => true, fetchPage }) {
  let offset = 0;
  const items = [];
  const seen = new Set();
  
  while (items.length < maxItems) {
    let res;
    try {
      res = await fetchPage(offset);
    } catch (err) {
      if (err.status === 429) throw err;
      break;
    }
    if (!res || !res.items || res.items.length === 0) {
      break;
    }
    for (const item of res.items) {
      if (!item) continue;
      const key = item.id || item.uri || JSON.stringify(item);
      if (seen.has(key)) continue;
      seen.add(key);
      if (accept(item)) {
        items.push(item);
        if (items.length >= maxItems) break;
      }
    }
    if (!res.next) {
      break;
    }
    offset += 10;
  }
  return items;
}

module.exports = { collectPages };
