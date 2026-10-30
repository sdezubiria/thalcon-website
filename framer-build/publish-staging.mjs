// Publishes the project to its free Framer subdomain (no custom domain) and
// prints the URL. Refuses if the project has a custom domain, so it can't
// touch a live site by accident.
import { connect } from "framer-api"

const projectUrl = process.argv.slice(2).find((a) => a.startsWith("https://")) ?? process.env.FRAMER_PROJECT_URL
const framer = await connect(projectUrl, process.env.FRAMER_API_KEY)
try {
    const info = await framer.getPublishInfo().catch(() => null)
    const custom = JSON.stringify(info ?? {}).match(/"type":"custom"/)
    if (custom) throw new Error("This project has a custom domain; publish from Framer instead.")
    const { deployment, hostnames } = await framer.publish()
    for (let i = 0; i < 30; i++) {
        const d = await framer.getDeployment(deployment.id)
        if (d.status !== "pending") break
        await new Promise((r) => setTimeout(r, 2000))
    }
    console.log(hostnames.map((h) => `https://${h.hostname}  (${h.type})`).join("\n"))
} finally {
    await framer.disconnect()
}
