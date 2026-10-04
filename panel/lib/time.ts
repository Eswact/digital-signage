/** "2 dk önce" gibi göreli Türkçe zaman. */
export function timeAgo(iso?: string | null): string {
  if (!iso) return 'hiç';
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 10) return 'az önce';
  if (s < 60) return `${s} sn önce`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} dk önce`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} sa önce`;
  const d = Math.floor(h / 24);
  return `${d} gün önce`;
}
