// Send link-preview bots (iMessage, WhatsApp, Slack and friends) opening a join link to
// api/join, which fills in the round's game, course and players. This has to be middleware:
// a rewrite in vercel.json never runs for "/", because the static index.html answers first.
// People opening the link skip all this and get the app straight away.
import { rewrite } from '@vercel/functions';

const BOTS = /facebookexternalhit|Facebot|Twitterbot|WhatsApp|Slackbot|Discordbot|TelegramBot|LinkedInBot|SkypeUriPreview|Applebot|redditbot|Iframely|Embedly|Pinterest|Google-PageRenderer|Mastodon|bingbot|Googlebot/i;

export const config = { matcher: '/' };

export default function middleware(request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('join');
  if (!code || !/^[A-Za-z0-9]{4,8}$/.test(code)) return;
  if (!BOTS.test(request.headers.get('user-agent') || '')) return;
  return rewrite(new URL(`/api/join?code=${code}`, request.url));
}
