import { ThesisCatalogPage } from "@monteai/ui/pages"
import { thesisService } from "../lib/thesisService"

export default function Theses() { 
    return (
        <ThesisCatalogPage thesisService={thesisService}/>
    )
} 