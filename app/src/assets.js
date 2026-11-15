// Where the things the page fetches by name are kept: the scanned surfaces, the statues, the pictures in the halls,
// the hands cut for the name boards. They are not imported, so no bundler knows them; they lie beside the page, in
// the same folders whether it is served from the source tree or from the built site, and are found from the page's
// own address. In Node (the unit tests) there is no page, and they are found from this file.
const here = import.meta.url;
const base = typeof document !== "undefined" && document.baseURI ? document.baseURI : new URL("../", here).href;
export const asset = (path) => new URL(path, base).href;
