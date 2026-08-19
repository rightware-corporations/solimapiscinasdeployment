const levels = { debug: 10, info: 20, warn: 30, error: 40 };

export function createLogger({ level = "info", sink = console } = {}) {
  const threshold = levels[level] ?? levels.info;
  const write = (name, event, fields = {}) => {
    if (levels[name] < threshold) return;
    sink[name === "debug" ? "log" : name](JSON.stringify({ level: name, event, timestamp: new Date().toISOString(), ...fields }));
  };
  return Object.freeze({
    debug: (event, fields) => write("debug", event, fields),
    info: (event, fields) => write("info", event, fields),
    warn: (event, fields) => write("warn", event, fields),
    error: (event, fields) => write("error", event, fields)
  });
}
