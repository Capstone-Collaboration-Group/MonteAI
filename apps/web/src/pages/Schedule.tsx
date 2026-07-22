import { SchedulePage } from "@monteai/ui";
import { scheduleService } from "../lib/scheduleService";

export default function Schedule() {
  return <SchedulePage scheduleService={scheduleService} />;
}