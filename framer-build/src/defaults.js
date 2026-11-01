/* Default content for the ThalconSite component: exactly what index.html shows.
   generate.mjs checks these against index.html before every deploy.
   ASSETS maps a site path (assets/img/…) to its uploaded Framer URL. */
export const defaults = (ASSETS) => {
    const img = (path, alt = "") => (ASSETS[path] ? { src: ASSETS[path], alt } : undefined)
    const job = (title) => ({
        title,
        subtitle: "sub title",
        location: "miami, fl",
        description: "Full job description coming soon.",
        email: "elias@thalconmix.com",
    })
    return {
        stats: [
            { value: "186.9", unit: "kg CO₂e/yd³", caption: "Our 70% slag mix, cradle to gate (A1–A3)" },
            { value: "−31.3%", unit: "", caption: "vs. the NRMCA South Central baseline of 272.2" },
            { value: "10,888\u00a0t", unit: "→ 7,476\u00a0t", caption: "Total GWP on a 40,000 CY slab on grade: baseline vs. our mix" },
            { value: "−3,412\u00a0t", unit: "", caption: "less CO₂e on a single placement" },
        ],
        statsImage: img("assets/img/aerial-tracks.jpg", "Aerial view of tire tracks across a graded site"),
        certifications: [
            { name: "National Ready Mixed Concrete Association", logo: img("assets/img/logo-nrmca.png"), note: "" },
            { name: "American \nConcrete Institute", logo: img("assets/img/logo-aci.png"), note: "" },
            { name: "ACI \nSouth Florida", logo: img("assets/img/logo-aci.png"), note: "South Florida" },
        ],
        partners: [
            { name: "Concourse", logo: img("assets/img/partner-concourse.png"), logoWidth: 144, logoHeight: 143 },
            { name: "Thales Builders Corp", logo: img("assets/img/partner-thales.png"), logoWidth: 294, logoHeight: 90 },
            { name: "RHa", logo: img("assets/img/logo-rha.png"), logoWidth: 286, logoHeight: 92 },
            { name: "Kimera", logo: img("assets/img/logo-kimera.png"), logoWidth: 212, logoHeight: 208 },
        ],
        jobs: ["Mechanic", "Sales Marketing", "Procurement", "Product Development"].map(job),
    }
}
