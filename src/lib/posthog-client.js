// The PostHog library, loaded after the first paint and only with a key (ops.js). The slim build:
// events we send ourselves and nothing else, so no autocapture of taps or typing, no session
// recording, no surveys, and no scripts fetched from PostHog. Addresses keep their path only
// (scrub.js cleanUrlProps). The id is PostHog's own random one, or a hash of the account id once
// someone signs in (ops.js), never an email or a name.
import posthog from 'posthog-js/dist/module.slim';
import { cleanUrlProps } from './scrub.js';

/** Start PostHog and hand back what the tracker needs (analytics.js createTracker). */
export function startPostHog({ key, host, enabled = true }) {
  posthog.init(key, {
    api_host: host,
    defaults: '2026-05-30',
    autocapture: false,
    capture_pageview: false,
    capture_pageleave: false,
    capture_dead_clicks: false,
    capture_heatmaps: false,
    capture_exceptions: false,
    capture_performance: false,
    rageclick: false,
    disable_session_recording: true,
    disable_surveys: true,
    disable_external_dependency_loading: true,
    advanced_disable_flags: true,
    mask_all_text: true,
    mask_all_element_attributes: true,
    mask_personal_data_properties: true,
    save_referrer: false,
    person_profiles: 'identified_only',
    // On the phone only, no cookies
    persistence: 'localStorage',
    opt_out_capturing_by_default: !enabled,
    before_send: e => (e ? { ...e, properties: cleanUrlProps(e.properties), $set: cleanUrlProps(e.$set), $set_once: cleanUrlProps(e.$set_once) } : e),
  });
  // Switched off once and back on: PostHog remembers the old opt-out on the phone, so lift it
  if (enabled && posthog.has_opted_out_capturing()) posthog.opt_in_capturing({ captureEventName: false });
  return {
    capture: (event, props) => posthog.capture(event, props),
    identify: id => posthog.identify(id),
    reset: () => posthog.reset(),
    setEnabled: on => (on ? posthog.opt_in_capturing({ captureEventName: false }) : posthog.opt_out_capturing()),
  };
}
