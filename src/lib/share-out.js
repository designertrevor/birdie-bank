// shareOut, the one way the app shares into the group's text thread (share.js has the rules and
// re-exports these). Its own small file with no imports, so pay.js, which the first screen loads,
// can send a reminder without pulling in the rest of sharing.

/** The text with the link on a line of its own at the end (once, even if it's already in it). */
export function withLink(text, url) {
  const t = String(text || '').trim();
  if (!url || t.includes(url)) return t;
  return t ? `${t}\n${url}` : url;
}

// --------------------------- sharing ----------------------------------------

/** The browser's own pieces, for shareOut. */
export function browserEnv() {
  const nav = typeof navigator !== 'undefined' ? navigator : null;
  return {
    nav,
    phone: !!nav && /iPhone|iPad|Android/i.test(nav.userAgent || ''),
    makeFile: img => (typeof File === 'undefined' ? null : new File([img.blob], img.name, { type: img.blob.type || 'image/png' })),
    copy: async text => { try { await nav.clipboard.writeText(text); return true; } catch { return false; } },
    save: img => {
      try {
        const url = img.url || URL.createObjectURL(img.blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = img.name;
        document.body.appendChild(a);
        a.click();
        a.remove();
        if (!img.url) setTimeout(() => URL.revokeObjectURL(url), 10000);
        return true;
      } catch { return false; }
    },
    sms: text => { location.href = `sms:?&body=${encodeURIComponent(text)}`; return true; },
  };
}

/**
 * Share into the group text. `payload`: { title, text, url, image: { blob, name, url? } | null }.
 * Resolves to what happened: 'shared', 'cancelled', 'sms', 'copied', 'saved' (the image only),
 * 'copied-saved' (the text copied and the image saved) or 'failed'.
 */
export async function shareOut({ title = '', text = '', url = null, image = null } = {}, env = browserEnv()) {
  const { nav } = env;
  const body = withLink(text, url);
  if (image?.blob) {
    const file = env.makeFile(image);
    if (file && nav?.canShare?.({ files: [file] })) {
      // The text goes with it where the app takes both (Messages does); the link is in it
      const data = body && nav.canShare({ files: [file], text: body }) ? { files: [file], text: body } : { files: [file] };
      if (title) data.title = title;
      try { await nav.share(data); return 'shared'; }
      catch (e) { if (e?.name === 'AbortError') return 'cancelled'; }
    }
    const copied = body ? await env.copy(body) : false;
    const saved = env.save(image);
    return copied && saved ? 'copied-saved' : saved ? 'saved' : copied ? 'copied' : 'failed';
  }
  if (!body) return 'failed';
  if (nav?.share) {
    try { await nav.share(title ? { title, text: body } : { text: body }); return 'shared'; }
    catch (e) { if (e?.name === 'AbortError') return 'cancelled'; }
  }
  if (env.phone && env.sms?.(body)) return 'sms';
  return (await env.copy(body)) ? 'copied' : 'failed';
}
