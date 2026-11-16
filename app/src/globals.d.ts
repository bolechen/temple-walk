// What the type checker must be told that the code does not say: the hooks the page hangs on `window` for the tests
// and tools (`__yard()`, `__probe()`, `__tour()` …; CLAUDE.md lists them).
interface Window { [hook: `__${string}`]: any }
interface Window { webkitAudioContext?: typeof AudioContext; templeLoading?: any }
interface Window { umami?: { track?: (name: string, data?: Record<string, string>) => void } }
// Everything this page looks up by selector is an HTML element (it has no SVG or MathML of its own).
interface ParentNode { querySelectorAll(selectors: string): NodeListOf<HTMLElement> }
