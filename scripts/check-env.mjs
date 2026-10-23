const value = process.env.VITE_API_BASE_URL;
try {
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname.replace(/\/$/, "").endsWith("/api")
  )
    throw Error();
} catch {
  console.error(
    "Set repository variable VITE_API_BASE_URL to your HTTPS Worker root URL (without /api, credentials, query or fragment).",
  );
  process.exit(1);
}
console.log("Public API URL is configured.");
