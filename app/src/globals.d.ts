// What the type checker must be told that the code does not say: the hooks the page hangs on `window` for the tests
// and tools (`__yard()`, `__probe()`, `__tour()` …; CLAUDE.md lists them).
interface Window { [hook: `__${string}`]: any }
