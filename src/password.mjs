/** Client-side stretching keeps the 600k PBKDF2 work factor off the free Worker.
 * The returned proof is a password-equivalent: never persist or log it. */
export async function deriveProof(password, challenge) {
  if (
    challenge.algorithm !== "PBKDF2-SHA256-v1" ||
    challenge.iterations !== 600000 ||
    !/^[0-9a-f]{32}$/.test(challenge.salt)
  )
    throw Error("服务端登录协议不兼容");
  const salt = Uint8Array.from(challenge.salt.match(/../g), (x) =>
    parseInt(x, 16),
  );
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const result = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: challenge.iterations, hash: "SHA-256" },
    key,
    256,
  );
  return Array.from(new Uint8Array(result), (x) =>
    x.toString(16).padStart(2, "0"),
  ).join("");
}
