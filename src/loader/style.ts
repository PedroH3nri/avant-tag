/**
 * O CSS do loader e do aviso de adblock, com prefixo `avl-` para não colidir com o site.
 */

export const STYLE_ID = 'avant-loader-style'

export const LOADER_CSS = `
.avl-layer{position:fixed;inset:0;z-index:2147483646;display:grid;place-items:center;overflow-y:auto;padding:16px;box-sizing:border-box;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;transition:opacity .4s ease-out,transform .4s ease-out;animation:avl-in .3s ease-out}
.avl-layer.avl-inline{position:absolute}
.avl-layer.avl-out{opacity:0;transform:scale(1.02);pointer-events:none}
.avl-ring{position:relative;display:grid;place-items:center;width:72px;height:72px}
.avl-glow{position:absolute;inset:0;border-radius:50%}
.avl-arc{position:absolute;inset:0;width:100%;height:100%;animation:avl-spin 1.4s linear infinite}
.avl-arc circle:last-child{stroke-dasharray:1 207;animation:avl-dash 1.4s ease-in-out infinite}
.avl-stack{display:grid;justify-items:center;gap:16px;text-align:center}
.avl-icon{display:inline-grid;place-items:center;overflow:hidden;border-radius:22%;object-fit:cover}
.avl-name{font-weight:700;font-size:15px;letter-spacing:-.01em}
.avl-bar{position:relative;width:160px;height:4px;overflow:hidden;border-radius:9999px}
.avl-bar span{position:absolute;top:0;bottom:0;left:0;width:33%;border-radius:9999px;animation:avl-bar 1.1s ease-in-out infinite}
.avl-spinner{width:32px;height:32px;border-radius:50%;border:3px solid;animation:avl-spin .8s linear infinite;box-sizing:border-box}
.avl-dots{display:flex;gap:6px}
.avl-dots span{width:10px;height:10px;border-radius:50%;animation:avl-bounce 1s infinite}
.avl-text{font-size:12px;opacity:.7}
.avl-card{display:flex;flex-direction:column;align-items:center;width:100%;max-width:340px;box-sizing:border-box;border-radius:16px;background:#fff;padding:24px 24px 20px;text-align:center;color:#262626;box-shadow:0 24px 48px -12px rgba(0,0,0,.35);animation:avl-zoom .25s ease-out}
.avl-title{margin:16px 0 0;font-size:17px;font-weight:600;letter-spacing:-.01em}
.avl-body{margin:8px 0 0;font-size:13px;line-height:1.6;color:#737373}
.avl-hint{margin:12px 0 0;width:100%;box-sizing:border-box;border-radius:8px;background:#f5f5f5;padding:8px 12px;font-size:12px;line-height:1.4;color:#737373}
.avl-button{margin-top:16px;height:40px;width:100%;border:0;border-radius:8px;font:600 13px system-ui,sans-serif;cursor:pointer}
.avl-skip{margin-top:8px;border:0;background:none;font:12px system-ui,sans-serif;color:#737373;cursor:pointer}
.avl-brand{margin:16px 0 0;font-size:10px;letter-spacing:.08em;color:#d4d4d4}
@keyframes avl-in{from{opacity:0}}
@keyframes avl-zoom{from{opacity:0;transform:scale(.95)}}
@keyframes avl-spin{to{transform:rotate(360deg)}}
@keyframes avl-dash{50%{stroke-dasharray:120 207;stroke-dashoffset:-30}to{stroke-dasharray:1 207;stroke-dashoffset:-206}}
@keyframes avl-bar{from{transform:translateX(-100%)}to{transform:translateX(300%)}}
@keyframes avl-bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
@media (prefers-reduced-motion:reduce){.avl-layer,.avl-card{animation:none;transition:none}.avl-arc,.avl-arc circle,.avl-bar span,.avl-spinner,.avl-dots span{animation:none}.avl-arc circle:last-child{stroke-dasharray:60 207}}
`

/** Põe o CSS no documento uma vez só. */
export function ensureStyle(page: Document): void {
  if (page.getElementById(STYLE_ID)) return
  const style = page.createElement('style')
  style.id = STYLE_ID
  style.textContent = LOADER_CSS
  page.head.append(style)
}
