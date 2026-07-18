import { getVisibleAnnouncements } from "@/lib/announcements";
import SiteBannerClient from "@/components/SiteBannerClient";

export default async function SiteBanner() {
  const announcements = await getVisibleAnnouncements();
  if (announcements.length === 0) return null;
  return <SiteBannerClient announcements={announcements} />;
}
