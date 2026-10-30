// Renders the generated ThalconSite component full width, like a Framer page.
import { createRoot } from "react-dom/client"
import ThalconSite from "../generated/ThalconSite.tsx"

const el = document.getElementById("root")
createRoot(el).render(<ThalconSite />)
