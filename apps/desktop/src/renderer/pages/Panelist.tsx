import { PanelistPage } from "@monteai/ui";
import { panelistScheduleService } from "../lib/panelistScheduleService";

export default function Panelist() { 
    return (
        <PanelistPage 
        panelistScheduleService={panelistScheduleService}
        />
    )
}