
import "./App.css";
import { Button, Card, Toaster} from "@monteai/ui";

function App() {
  return (
 <div>
      <Toaster />
      <Card>
        <Button onClick={() => alert("clicked")}>Save</Button>
      </Card>
    </div>
  )
}

export default App;