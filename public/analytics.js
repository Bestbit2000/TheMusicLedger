// PostHog usage tracking (ML-47). Autocapture only - clicks on every button
// are recorded automatically by PostHog itself (tagged by DOM selector/text),
// so no per-button instrumentation is needed to answer "which buttons are
// actually used".
//
// PostHog project API keys are meant to be public/client-side (like a Google
// Analytics ID), so it's fine for this to live in this static, checked-in
// file - there is no build step in public/ to inject it from the server.
// Project: PostHog EU (data residency chosen at project creation).
const POSTHOG_KEY = 'phc_qzCAStK9YaADaSt85ay2Qm3d32Y2jR5tDaLwAJkPUETj';
const POSTHOG_HOST = 'https://eu.i.posthog.com';

if (POSTHOG_KEY) {
    !function (t, e) { var o, n, p, r; e.__SV || (window.posthog && window.posthog.__loaded) || (window.posthog = e, e._i = [], e.init = function (i, s, a) { function g(t, e) { var o = e.split("."); 2 == o.length && (t = t[o[0]], e = o[1]), t[e] = function () { t.push([e].concat(Array.prototype.slice.call(arguments, 0))) } } p || ((p = t.createElement("script")).type = "text/javascript", p.crossOrigin = "anonymous", p.async = !0, p.src = s.api_host.replace(".i.posthog.com", "-assets.i.posthog.com") + "/static/array.js", p.onerror = function () { p = null }, (r = t.getElementsByTagName("script")[0]).parentNode.insertBefore(p, r)); var u = e; for (void 0 !== a ? u = e[a] = [] : a = "posthog", u.people = u.people || [], Object.defineProperty(u, "toString", { configurable: !0, enumerable: !0, writable: !0, value: function (t) { var e = "posthog"; return "posthog" !== a && (e += "." + a), t || (e += " (stub)"), e } }), Object.defineProperty(u.people, "toString", { configurable: !0, enumerable: !0, writable: !0, value: function () { return u.toString(1) + ".people (stub)" } }), o = "su ru ou lu hu init Au Fu Eu Pu Nu zl Ru ju Tu Uu Wu Vu capture getExtension Ou iu Qu calculateEventProperties Zu register register_once register_for_session unregister unregister_for_session Xu Mu Ju getFeatureFlag getFeatureFlagPayload getFeatureFlagResult getAllFeatureFlags isFeatureEnabled reloadFeatureFlags updateFlags updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures on onFeatureFlags onSurveysLoaded onSessionId getSurveys getActiveMatchingSurveys renderSurvey displaySurvey cancelPendingSurvey canRenderSurvey canRenderSurveyAsync th identify setPersonProperties unsetPersonProperties group resetGroups setPersonPropertiesForFlags resetPersonPropertiesForFlags setGroupPropertiesForFlags resetGroupPropertiesForFlags reset eh shutdown setIdentity clearIdentity get_distinct_id getGroups get_session_id get_session_replay_url alias set_config startSessionRecording stopSessionRecording sessionRecordingStarted captureException addExceptionStep captureLog startExceptionAutocapture stopExceptionAutocapture loadToolbar get_property getSessionProperty Ku zu createPersonProfile setInternalOrTestUser Yu cu du opt_in_capturing opt_out_capturing has_opted_in_capturing has_opted_out_capturing get_explicit_consent_status is_capturing clear_opt_in_out_capturing Bu debug Ul $s getPageViewId captureTraceFeedback captureTraceMetric Su".split(" "), n = 0; n < o.length; n++)g(u, o[n]); e._i.push([i, s, a]) }, e.__SV = 1) }(document, window.posthog || []);
    posthog.init(POSTHOG_KEY, {
        api_host: POSTHOG_HOST,
        defaults: '2026-05-30',
        person_profiles: 'identified_only',
    });

    // Don't let clicks made while developing locally pollute real usage stats.
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        posthog.opt_out_capturing();
    }
}
