// Just enough of a browser for the modules that draw on a canvas at build time to run under Node.
const ctx = new Proxy({}, { get: (t, k) => (k in t ? t[k] : k === "createRadialGradient" || k === "createLinearGradient" ? () => ({ addColorStop() {} }) : k === "measureText" ? () => ({ width: 10 }) : () => {}), set: (t, k, v) => ((t[k] = v), true) });
globalThis.document = globalThis.document || {
  createElement: () => ({ width: 0, height: 0, style: {}, getContext: () => ctx, addEventListener() {} }),
  createElementNS: () => ({ style: {}, getContext: () => ctx }),
  fonts: { load: () => Promise.resolve([]) },
};
