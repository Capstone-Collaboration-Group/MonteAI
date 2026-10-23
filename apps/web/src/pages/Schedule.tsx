import { SchedulePage } from "@monteai/ui";
import { scheduleService } from "../lib/scheduleService";

// Schedules are view-only on the web for every role, Admin included
// (SchedulePage defaults canEdit to false). Creating and editing defense
// schedules lives exclusively in the desktop admin panel.
export default function Schedule() {
  return <SchedulePage scheduleService={scheduleService} />;
}
