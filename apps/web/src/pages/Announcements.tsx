  import { AnnouncementsPanel } from "@monteai/ui";
  import { announcementService } from "../lib/announcementService";

  export default function Announcements() {
    return <AnnouncementsPanel role="Student"
    announcementService={announcementService} />;
  }