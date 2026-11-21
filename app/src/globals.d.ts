// What the type checker must be told that the code does not say: the hooks the page hangs on `window` for the tests
// and tools (`__yard()`, `__probe()`, `__tour()` …; CLAUDE.md lists them).
interface Window { [hook: `__${string}`]: any }
interface Window { webkitAudioContext?: typeof AudioContext; templeLoading?: any; templeRelang?: (to: string) => boolean }
interface Window { umami?: { track?: (name: string, data?: Record<string, string>) => void } }
// Everything this page looks up by selector is an HTML element (it has no SVG or MathML of its own).
interface ParentNode { querySelectorAll(selectors: string): NodeListOf<HTMLElement> }
// The build's channel (src/channel.js), defined by vite.config.mjs; absent when the sources are run in Node.
declare const __CHANNEL__: "web" | "steam" | "platform";
declare const __DEPLOY__: "production" | "canary" | "preview";
/** Whether the workbench's levels are in this build: a preview (and the dev server) unless VITE_NO_WORKBENCH=1, which the build test uses to set them aside (app/src/level.js). */
declare const __WORKBENCH__: boolean;
// Which version and commit the build is, and the pull request a preview is for (src/version.js, #310).
declare const __VERSION__: string;
declare const __COMMIT__: string;
declare const __PR__: string;
