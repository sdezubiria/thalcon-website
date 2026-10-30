// Minimal stand-in for Framer's "framer" module, so the generated component
// can run in a plain React page for local testing.
export const addPropertyControls = () => {}
export const ControlType = new Proxy({}, { get: (_, k) => String(k) })
export const RenderTarget = { canvas: "canvas", thumbnail: "thumbnail", preview: "preview", export: "export", current: () => "preview" }
export const useIsStaticRenderer = () => false
