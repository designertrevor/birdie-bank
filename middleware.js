// Send link-preview bots (iMessage, WhatsApp, Slack and friends) opening one of the app's links
// (a round's ?join=, a plan's ?plan=, a challenge's ?challenge= or a captain's ?draft=) to
// api/join, which fills in what the link is: the game, the course, who sent it and the day. This
// has to be middleware: a rewrite in vercel.json never runs for "/", because the static index.html
// answers first. People opening the link skip all this and get the app straight away.
import { rewrite } from '@vercel/functions';
import { linkTarget, previewApiPath } from './src/lib/link-target.js';

const BOTS = /facebookexternalhit|Facebot|Twitterbot|WhatsApp|Slackbot|Discordbot|TelegramBot|LinkedInBot|SkypeUriPreview|Applebot|redditbot|Iframely|Embedly|Pinterest|Google-PageRenderer|Mastodon|bingbot|Googlebot/i;

export const config = { matcher: '/' };

export default function middleware(request) {
  const url = new URL(request.url);
  const target = linkTarget(url.searchParams);
  if (!target) return;
  if (!BOTS.test(request.headers.get('user-agent') || '')) return;
  return rewrite(new URL(previewApiPath(target), request.url));
}
