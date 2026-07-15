// apps/desktop/src/App.tsx (or wherever your renderer root component is)
import { Button, Card, Toaster, ChatPreview } from "@monteai/ui";


function App() {
  return (
    <div>
        <h1>hello?</h1>
        <ChatPreview />
      <Toaster />
      <Card>
        <Button onClick={() => alert("clicked")}>Save</Button>
      </Card>
    </div>
  );
}

export default App;