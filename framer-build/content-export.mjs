// Saves the content the client edited on the ThalconSite instance, so it can be
// moved to another project: npm run deploy -- <other project url> --content content.json
//
//   npm run content:export                    → content.json, from FRAMER_PROJECT_URL
//   npm run content:export -- <project url>   → from another project
import { writeFile } from "node:fs/promises"
import { connect } from "framer-api"

const projectUrl = process.argv.slice(2).find((a) => a.startsWith("https://")) ?? process.env.FRAMER_PROJECT_URL
const framer = await connect(projectUrl, process.env.FRAMER_API_KEY)
try {
    const [instance] = (await framer.getNodesWithType("ComponentInstanceNode")).filter((n) => n.name === "Thalcon site")
    if (!instance) throw new Error("No “Thalcon site” instance in this project")
    await writeFile("content.json", JSON.stringify(instance.controls, null, 2))
    console.log(`Saved content.json (${Object.keys(instance.controls).join(", ") || "all defaults"})`)
} finally {
    await framer.disconnect()
}
