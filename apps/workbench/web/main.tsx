import { createRoot } from "react-dom/client";
import { Chat } from "./Chat";

// Chat connects to key ["me", userId]; "nasir" is the same Nasir the CLI uses.
createRoot(document.getElementById("root")!).render(<Chat userId="nasir" />);
