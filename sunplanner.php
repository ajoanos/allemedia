<?php
/*
Plugin Name: SunPlanner – planer plenerów ślubnych
Plugin URI: https://allemedia.pl/
Description: Inteligentny planer plenerów ślubnych, który łączy pogodę, światło, logistykę i inspiracje w jednym miejscu.
Version: 1.7.0
Author: Allemedia
Author URI: https://allemedia.pl/
License: GPLv2 or later
Text Domain: sunplanner
*/

namespace {
    if (!defined('SUNPLANNER_FILE')) {
        define('SUNPLANNER_FILE', __FILE__);
    }
}

namespace SunPlanner {

final class Templates
{
    public static function locate(string $template): string
    {
        $template = ltrim($template, '/');

        if ($template === '') {
            return '';
        }

        $theme_template = \locate_template([
            'sunplanner/' . $template,
            'sunplanner-' . $template,
            $template,
        ]);

        if (is_string($theme_template) && $theme_template !== '') {
            return $theme_template;
        }

        $plugin_template = \plugin_dir_path(SUNPLANNER_FILE) . 'templates/' . $template;

        if (file_exists($plugin_template)) {
            return $plugin_template;
        }

        return '';
    }
}

}

namespace {

use SunPlanner\Templates;
use Allemedia\SunPlanner\Rest\Contact_Controller;

if (!defined('SUNPLANNER_LANDING_OPTION')) {
    define('SUNPLANNER_LANDING_OPTION', 'sunplanner_landing_page_id');
}

if (!defined('SUNPLANNER_LANDING_META')) {
    define('SUNPLANNER_LANDING_META', '_sunplanner_landing');
}

function sunplanner_get_landing_page_id(): int
{
    return (int) get_option(SUNPLANNER_LANDING_OPTION, 0);
}

function sunplanner_is_landing_page(): bool
{
    $landing_id = sunplanner_get_landing_page_id();

    return $landing_id > 0 && is_page($landing_id);
}

function sunplanner_ensure_landing_page(): int
{
    $page_id = sunplanner_get_landing_page_id();

    if ($page_id > 0) {
        $existing = get_post($page_id);

        if ($existing instanceof \WP_Post && $existing->post_status !== 'trash') {
            if (!metadata_exists('post', $existing->ID, SUNPLANNER_LANDING_META)) {
                update_post_meta($existing->ID, SUNPLANNER_LANDING_META, '1');
            }

            return (int) $existing->ID;
        }
    }

    $with_meta = get_posts([
        'post_type'      => 'page',
        'post_status'    => ['publish', 'draft', 'pending'],
        'meta_key'       => SUNPLANNER_LANDING_META,
        'meta_value'     => '1',
        'posts_per_page' => 1,
        'fields'         => 'ids',
    ]);

    if (!empty($with_meta)) {
        $found_id = (int) $with_meta[0];
        update_option(SUNPLANNER_LANDING_OPTION, $found_id);

        return $found_id;
    }

    $by_path = get_page_by_path('sunplanner-landing', OBJECT, 'page');

    if ($by_path instanceof \WP_Post && $by_path->post_status !== 'trash') {
        update_post_meta($by_path->ID, SUNPLANNER_LANDING_META, '1');
        update_option(SUNPLANNER_LANDING_OPTION, (int) $by_path->ID);

        return (int) $by_path->ID;
    }

    $page_data = [
        'post_title'   => __('SunPlanner – inteligentny planer plenerów ślubnych', 'sunplanner'),
        'post_name'    => 'sunplanner-landing',
        'post_status'  => 'publish',
        'post_type'    => 'page',
        'post_content' => '<!-- SunPlanner landing page -->',
        'meta_input'   => [SUNPLANNER_LANDING_META => '1'],
    ];

    $inserted = wp_insert_post($page_data, true);

    if (!is_wp_error($inserted) && $inserted) {
        $inserted_id = (int) $inserted;
        update_option(SUNPLANNER_LANDING_OPTION, $inserted_id);

        return $inserted_id;
    }

    return 0;
}
add_action('init', function () {
    add_rewrite_tag('%sunplan%', '([A-Za-z0-9_-]+)');
    add_rewrite_rule('^sp/([A-Za-z0-9_-]+)/?$', 'index.php?sunplan=$matches[1]', 'top');
});

add_action('after_setup_theme', function () {
    add_image_size('insp-xxl', 2200, 0, false);
    add_image_size('insp-xl', 1600, 0, false);
    add_image_size('insp-lg', 1200, 0, false);
    add_image_size('insp-md', 900, 0, false);
    add_image_size('insp-sm', 600, 0, false);
});

register_activation_hook(SUNPLANNER_FILE, function () {
    sunplanner_ensure_landing_page();
    flush_rewrite_rules();
});
register_deactivation_hook(SUNPLANNER_FILE, function () { flush_rewrite_rules(); });



add_filter('query_vars', function ($vars) { $vars[] = 'sunplan'; return $vars; });

add_action('init', function () {
    $landing_id = sunplanner_get_landing_page_id();

    if ($landing_id <= 0) {
        sunplanner_ensure_landing_page();

        return;
    }

    $page = get_post($landing_id);

    if (!$page instanceof \WP_Post || $page->post_status === 'trash') {
        sunplanner_ensure_landing_page();
    }
}, 20);


/** === Assets === */

add_action('wp_enqueue_scripts', function () {
    $ver = '1.7.5';

    wp_register_style('sunplanner-css', plugins_url('assets/css/sunplanner.css', SUNPLANNER_FILE), [], $ver);
    wp_register_style('sunplanner-landing-fonts', 'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;600&family=Inter:wght@400;500;600&display=swap', [], null);
    wp_register_style('sunplanner-landing', plugins_url('assets/css/sunplanner-landing.css', SUNPLANNER_FILE), [], $ver);
    wp_register_script('sunplanner-app', plugins_url('assets/js/sunplanner.js', SUNPLANNER_FILE), [], $ver, true);

    if (sunplanner_is_landing_page()) {
        wp_enqueue_style('sunplanner-landing-fonts');
        wp_enqueue_style('sunplanner-landing');
    }

    // Stub Google callback
    $stub = 'window.initSunPlannerMap = function(){ window.dispatchEvent(new Event("sunplanner:gmaps-ready")); };';

    wp_add_inline_script('sunplanner-app', $stub, 'before');

    // Google Maps SDK (async/defer + loading=async)
    $key = 'AIzaSyDP0vhFiZV_yDB8urPJtQ4UdKQpAzmuOcU';
    $gmaps_src = 'https://maps.googleapis.com/maps/api/js?key='
        . rawurlencode($key)
        . '&libraries=marker,places&language=pl&region=PL&v=weekly&loading=async&callback=initSunPlannerMap';

    wp_register_script('sunplanner-gmaps', $gmaps_src, [], null, true);
    if (function_exists('wp_script_add_data')) {
        wp_script_add_data('sunplanner-gmaps', 'async', true);
        wp_script_add_data('sunplanner-gmaps', 'defer', true);
    }

    // If /sp/<id> or ?sunplan=<id> present — fetch stored packed state
    $shared_sp = '';
    $spid = get_query_var('sunplan');
    if ($spid) {
        $opt_key = 'sunplanner_share_' . sanitize_key($spid);
        $val = get_option($opt_key, '');
        if (is_string($val) && $val !== '') {
            $shared_sp = $val;
        }
    }

    wp_localize_script('sunplanner-app', 'SUNPLANNER_CFG', [
        'GMAPS_KEY' => $key,
        'CSE_ID' => 'b1d6737102d8e4107',
        'UNSPLASH_KEY' => 'OpKQ3jt1C2MKJW3v2U8jkhH0gWwBWj2w5BhoTxfa0tY',
        'ASSETS_URL' => trailingslashit(plugins_url('assets/', SUNPLANNER_FILE)),
        'TZ' => wp_timezone_string(),
        'SHARED_SP' => $shared_sp,
        'SHARE_ID' => $spid,
        'SHARE_URL' => $spid ? esc_url_raw(home_url(trailingslashit('sp/' . rawurlencode($spid)))) : '',
        'REST_URL' => esc_url_raw(rest_url('sunplanner/v1/share')),
        'CONTACT_URL' => esc_url_raw(rest_url('sunplanner/v1/contact')),
        'SITE_ORIGIN' => esc_url_raw(home_url('/')),
        'RADAR_URL' => esc_url_raw(rest_url('sunplanner/v1/radar')),
    ]);
});

// Ensure enqueued assets are explicitly marked as UTF-8 for proper character rendering
add_filter('script_loader_tag', function ($tag, $handle, $src) {
if ($handle === 'sunplanner-app' && strpos($tag, ' charset=') === false) {
$tag = str_replace('<script ', '<script charset="utf-8" ', $tag);
}
return $tag;
}, 10, 3);

add_filter('style_loader_tag', function ($html, $handle, $href, $media) {
if (in_array($handle, ['sunplanner-css', 'sunplanner-landing'], true) && strpos($html, ' charset=') === false) {
$html = str_replace('<link ', '<link charset="utf-8" ', $html);
}
return $html;
}, 10, 4);


if (!function_exists('sunplanner_get_intro_block')) {
    function sunplanner_get_intro_block(): string
    {
        ob_start();
        ?>
        <section class="sp-hero" style="padding:72px 0; background:linear-gradient(135deg,#f8fafc 0%,#e0f2fe 100%); color:#0f172a;">
          <div class="sp-container" style="max-width:1160px; margin:0 auto; padding:0 24px;">
            <div class="sp-hero-grid" style="display:grid; gap:40px; grid-template-columns:repeat(auto-fit,minmax(320px,1fr)); align-items:center;">
              <div>
                <span style="display:inline-flex; align-items:center; gap:8px; background:rgba(14,165,233,0.16); color:#0e7490; font-weight:600; padding:6px 14px; border-radius:999px; text-transform:uppercase; letter-spacing:0.08em; font-size:13px;">
                  ☀️ Nowość 2024
                </span>
                <h1 style="margin:24px 0 18px; font-size:clamp(34px,4.6vw,58px); line-height:1.05;">
                  SunPlanner — zaplanuj plener w 5 minut
                </h1>
                <p style="max-width:520px; font-size:clamp(18px,2.2vw,22px); line-height:1.55; color:rgba(15,23,42,0.78);">
                  Jedno miejsce, które łączy światło, prognozę, logistykę i inspiracje. Wybierz lokalizację,
                  zobacz idealne godziny i wyślij gotowy plan jednym linkiem lub PDF-em.
                </p>
                <div style="display:flex; gap:14px; flex-wrap:wrap; margin:28px 0 24px;">
                  <a href="#sunplanner-app" style="background:#22c55e; color:#022c22; padding:14px 28px; border-radius:16px; font-weight:700; text-decoration:none; box-shadow:0 16px 32px rgba(34,197,94,0.3);">
                    Otwórz planer
                  </a>
                  <a href="#sunplanner-demo" style="background:#ffffff; color:#0f172a; padding:14px 26px; border-radius:16px; border:1px solid rgba(15,23,42,0.12); font-weight:600; text-decoration:none; box-shadow:0 12px 26px rgba(15,23,42,0.12);">
                    Zobacz demo (60 s)
                  </a>
                </div>
                <ul style="display:flex; gap:22px; flex-wrap:wrap; padding:0; margin:0; list-style:none; font-size:14px; letter-spacing:0.06em; text-transform:uppercase; color:rgba(15,23,42,0.65);">
                  <li style="min-width:120px;"><strong style="display:block; font-size:28px; color:#0f172a; letter-spacing:0;">350+</strong>sesji zaplanowanych</li>
                  <li style="min-width:120px;"><strong style="display:block; font-size:28px; color:#0f172a; letter-spacing:0;">8</strong>źródeł danych</li>
                  <li style="min-width:120px;"><strong style="display:block; font-size:28px; color:#0f172a; letter-spacing:0;">5 min</strong>do gotowego planu</li>
                </ul>
                <div style="display:flex; gap:10px; flex-wrap:wrap; margin-top:28px;">
                  <span style="display:inline-flex; align-items:center; gap:6px; background:rgba(34,197,94,0.18); color:#0f172a; padding:8px 14px; border-radius:999px; font-weight:500;">🌅 Złota &amp; niebieska godzina</span>
                  <span style="display:inline-flex; align-items:center; gap:6px; background:rgba(34,197,94,0.12); color:#0f172a; padding:8px 14px; border-radius:999px; font-weight:500;">🌦️ Prognoza godzinowa</span>
                  <span style="display:inline-flex; align-items:center; gap:6px; background:rgba(34,197,94,0.12); color:#0f172a; padding:8px 14px; border-radius:999px; font-weight:500;">🧭 Trasy &amp; punkty</span>
                  <span style="display:inline-flex; align-items:center; gap:6px; background:rgba(34,197,94,0.12); color:#0f172a; padding:8px 14px; border-radius:999px; font-weight:500;">📝 Lista zadań</span>
                  <span style="display:inline-flex; align-items:center; gap:6px; background:rgba(34,197,94,0.12); color:#0f172a; padding:8px 14px; border-radius:999px; font-weight:500;">📸 Inspiracje foto</span>
                  <span style="display:inline-flex; align-items:center; gap:6px; background:rgba(34,197,94,0.12); color:#0f172a; padding:8px 14px; border-radius:999px; font-weight:500;">🔗 Udostępnianie linkiem/PDF</span>
                </div>
              </div>
              <figure style="position:relative; margin:0;">
                <div style="position:absolute; inset:-14% -18% auto auto; width:180px; height:180px; background:radial-gradient(circle at 30% 30%, rgba(56,189,248,0.6), rgba(14,116,144,0)); filter:blur(0); opacity:0.6;"></div>
                <div style="position:absolute; inset:auto auto -18% -12%; width:220px; height:220px; background:radial-gradient(circle at 70% 70%, rgba(34,197,94,0.55), rgba(34,197,94,0)); opacity:0.5;"></div>
                <div style="position:relative; background:#ffffff; border-radius:28px; box-shadow:0 32px 64px rgba(15,23,42,0.18); padding:18px;">
                  <img src="https://placehold.co/520x360/png" alt="Podgląd interfejsu SunPlanner" style="width:100%; border-radius:20px;">
                </div>
                <figcaption style="margin-top:16px; font-size:14px; color:rgba(15,23,42,0.6);">
                  Podgląd planu plenerowego na laptopie i telefonie (demo).
                </figcaption>
              </figure>
            </div>
          </div>
        </section>

        <section class="sp-steps" style="padding:60px 0; background:#f1f5f9; color:#0f172a;">
          <div class="sp-container" style="max-width:1160px; margin:0 auto; padding:0 24px;">
            <header style="max-width:560px; margin:0 auto 40px; text-align:center;">
              <p style="margin:0; text-transform:uppercase; letter-spacing:0.12em; font-weight:600; color:#0e7490; font-size:13px;">Jak to działa</p>
              <h2 style="margin:12px 0 10px; font-size:clamp(28px,3.5vw,38px);">3 kroki do gotowego planu</h2>
              <p style="margin:0; color:rgba(15,23,42,0.65);">SunPlanner prowadzi Cię przez wybór lokalizacji, kontrolę pogody i szybkie udostępnianie planu ekipie.</p>
            </header>
            <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(240px,1fr)); gap:22px;">
              <div style="background:#ffffff; border-radius:22px; padding:26px; border:1px solid rgba(15,23,42,0.08); box-shadow:0 20px 40px rgba(15,23,42,0.08);">
                <div style="font-size:30px;">🗺️</div>
                <h3 style="margin:16px 0 10px; font-size:20px;">Wybierz miejsce</h3>
                <p style="margin:0; color:rgba(15,23,42,0.7);">Zaznacz lokalizacje, punkty zdjęć i czasy przejazdu — wszystko na jednej mapie.</p>
                <a href="#sunplanner-app" style="display:inline-block; margin-top:16px; color:#0e7490; font-weight:600;">Zobacz szczegóły →</a>
              </div>
              <div style="background:#ffffff; border-radius:22px; padding:26px; border:1px solid rgba(15,23,42,0.08); box-shadow:0 20px 40px rgba(15,23,42,0.08);">
                <div style="font-size:30px;">🌤️</div>
                <h3 style="margin:16px 0 10px; font-size:20px;">Ustaw światło i pogodę</h3>
                <p style="margin:0; color:rgba(15,23,42,0.7);">Sprawdź złotą i niebieską godzinę, zachmurzenie oraz temperaturę z 8 źródeł danych.</p>
                <a href="#sunplanner-app" style="display:inline-block; margin-top:16px; color:#0e7490; font-weight:600;">Poznaj prognozy →</a>
              </div>
              <div style="background:#ffffff; border-radius:22px; padding:26px; border:1px solid rgba(15,23,42,0.08); box-shadow:0 20px 40px rgba(15,23,42,0.08);">
                <div style="font-size:30px;">🤝</div>
                <h3 style="margin:16px 0 10px; font-size:20px;">Udostępnij plan</h3>
                <p style="margin:0; color:rgba(15,23,42,0.7);">Wyślij parze i ekipie jeden link lub PDF, zsynchronizuj zadania i checklisty.</p>
                <a href="#sunplanner-app" style="display:inline-block; margin-top:16px; color:#0e7490; font-weight:600;">Jak współpracujemy →</a>
              </div>
            </div>
          </div>
        </section>

        <section class="sp-integrations" style="padding:64px 0; background:#ffffff; color:#0f172a;">
          <div class="sp-container" style="max-width:1160px; margin:0 auto; padding:0 24px;">
            <div style="display:grid; gap:32px; grid-template-columns:repeat(auto-fit,minmax(280px,1fr)); align-items:start;">
              <div>
                <p style="margin:0; text-transform:uppercase; letter-spacing:0.12em; font-weight:600; color:#0e7490; font-size:13px;">Integracje &amp; automatyzacje</p>
                <h2 style="margin:14px 0 12px; font-size:clamp(28px,4vw,40px);">Całe studio plenerowe w jednym miejscu</h2>
                <p style="margin:0; color:rgba(15,23,42,0.66);">Łączymy dane pogodowe, mapy i listy zadań z notatkami kreatywnymi, żeby Twój plan zawsze był aktualny i gotowy do udostępnienia.</p>
              </div>
              <div style="display:grid; gap:18px;">
                <div style="display:flex; gap:16px; align-items:flex-start; padding:18px 20px; border-radius:18px; border:1px solid rgba(15,23,42,0.08); box-shadow:0 18px 36px rgba(15,23,42,0.08); background:linear-gradient(140deg,rgba(240,249,255,0.9),rgba(224,242,254,0.6));">
                  <span style="font-size:28px;">🛰️</span>
                  <div>
                    <h3 style="margin:0 0 6px; font-size:18px;">Dane pogodowe co 60 minut</h3>
                    <p style="margin:0; color:rgba(15,23,42,0.68);">Automatyczne aktualizacje prognozy i alerty o zmianach warunków.</p>
                  </div>
                </div>
                <div style="display:flex; gap:16px; align-items:flex-start; padding:18px 20px; border-radius:18px; border:1px solid rgba(15,23,42,0.08); box-shadow:0 18px 36px rgba(15,23,42,0.08); background:linear-gradient(140deg,rgba(236,253,245,0.95),rgba(209,250,229,0.6));">
                  <span style="font-size:28px;">🗺️</span>
                  <div>
                    <h3 style="margin:0 0 6px; font-size:18px;">Mapy offline i notatki terenowe</h3>
                    <p style="margin:0; color:rgba(15,23,42,0.68);">Zaznacz punkty, dodaj instrukcje kadru i zapisuj inspiracje w jednym widoku.</p>
                  </div>
                </div>
                <div style="display:flex; gap:16px; align-items:flex-start; padding:18px 20px; border-radius:18px; border:1px solid rgba(15,23,42,0.08); box-shadow:0 18px 36px rgba(15,23,42,0.08); background:linear-gradient(140deg,rgba(248,250,252,0.95),rgba(241,245,249,0.6));">
                  <span style="font-size:28px;">🤖</span>
                  <div>
                    <h3 style="margin:0 0 6px; font-size:18px;">Checklisty i automatyczne przypomnienia</h3>
                    <p style="margin:0; color:rgba(15,23,42,0.68);">Przydziel zadania, ustaw deadline’y i otrzymuj powiadomienia do zespołu.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="sunplanner-demo" class="sp-timeline" style="padding:64px 0 72px; background:linear-gradient(160deg,#e0f2fe 0%,#f8fafc 60%,#ecfeff 100%); color:#0f172a;">
          <div class="sp-container" style="max-width:1160px; margin:0 auto; padding:0 24px;">
            <header style="text-align:center; max-width:620px; margin:0 auto 48px;">
              <p style="margin:0; text-transform:uppercase; letter-spacing:0.12em; font-weight:600; color:#0e7490; font-size:13px;">Plan dnia w skrócie</p>
              <h2 style="margin:14px 0 12px; font-size:clamp(30px,4vw,44px);">Ułóż idealny harmonogram pleneru</h2>
              <p style="margin:0; color:rgba(15,23,42,0.7);">Przeciągnij etapy, dopasuj godziny do światła i miej wszystko gotowe przed sesją.</p>
            </header>
            <ol style="margin:0 auto 48px; padding:0; list-style:none; display:grid; gap:18px; grid-template-columns:repeat(auto-fit,minmax(220px,1fr));">
              <li style="background:#ffffff; border-radius:18px; padding:20px 22px; border:1px solid rgba(15,23,42,0.08); box-shadow:0 22px 44px rgba(14,116,144,0.1);">
                <div style="display:flex; align-items:center; justify-content:space-between; gap:12px;">
                  <span style="font-weight:700; color:#0e7490;">08:30</span>
                  <span style="font-size:24px;">☕</span>
                </div>
                <h3 style="margin:16px 0 10px; font-size:18px;">Spotkanie i rekonesans</h3>
                <p style="margin:0; color:rgba(15,23,42,0.68);">Sprawdzenie lokalizacji, szybka checklista sprzętu.</p>
              </li>
              <li style="background:#ffffff; border-radius:18px; padding:20px 22px; border:1px solid rgba(15,23,42,0.08); box-shadow:0 22px 44px rgba(14,116,144,0.1);">
                <div style="display:flex; align-items:center; justify-content:space-between; gap:12px;">
                  <span style="font-weight:700; color:#0e7490;">10:15</span>
                  <span style="font-size:24px;">🌿</span>
                </div>
                <h3 style="margin:16px 0 10px; font-size:18px;">Sesja w cieniu drzew</h3>
                <p style="margin:0; color:rgba(15,23,42,0.68);">Łagodne światło, ujęcia w ruchu i detale.</p>
              </li>
              <li style="background:#ffffff; border-radius:18px; padding:20px 22px; border:1px solid rgba(15,23,42,0.08); box-shadow:0 22px 44px rgba(14,116,144,0.1);">
                <div style="display:flex; align-items:center; justify-content:space-between; gap:12px;">
                  <span style="font-weight:700; color:#0e7490;">18:40</span>
                  <span style="font-size:24px;">🌅</span>
                </div>
                <h3 style="margin:16px 0 10px; font-size:18px;">Golden hour nad jeziorem</h3>
                <p style="margin:0; color:rgba(15,23,42,0.68);">Idealne światło, ujęcia szerokie i portretowe.</p>
              </li>
              <li style="background:#ffffff; border-radius:18px; padding:20px 22px; border:1px solid rgba(15,23,42,0.08); box-shadow:0 22px 44px rgba(14,116,144,0.1);">
                <div style="display:flex; align-items:center; justify-content:space-between; gap:12px;">
                  <span style="font-weight:700; color:#0e7490;">20:00</span>
                  <span style="font-size:24px;">✨</span>
                </div>
                <h3 style="margin:16px 0 10px; font-size:18px;">Udostępnij plan ekipie</h3>
                <p style="margin:0; color:rgba(15,23,42,0.68);">Eksport PDF, link dla pary i checklisty follow-up.</p>
              </li>
            </ol>
            <div style="background:#0f172a; color:#f8fafc; border-radius:26px; padding:38px; display:grid; gap:18px; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); align-items:center; box-shadow:0 28px 56px rgba(15,23,42,0.35);">
              <div>
                <h3 style="margin:0 0 8px; font-size:24px;">Gotowy, żeby zaplanować kolejny plener?</h3>
                <p style="margin:0; color:rgba(241,245,249,0.85);">Uruchom SunPlanner i zobacz demo w 60 sekund. Harmonogram dopasujesz w locie.</p>
              </div>
              <div style="display:flex; gap:14px; flex-wrap:wrap; justify-content:flex-end;">
                <a href="#sunplanner-app" style="background:#22c55e; color:#022c22; padding:14px 28px; border-radius:18px; font-weight:700; text-decoration:none;">Otwórz planer</a>
                <a href="#sunplanner-demo" style="background:rgba(248,250,252,0.12); color:#f8fafc; padding:14px 24px; border-radius:18px; border:1px solid rgba(248,250,252,0.3); font-weight:600; text-decoration:none;">Zobacz demo (60 s)</a>
              </div>
            </div>
          </div>
        </section>

        <section class="sp-faq" style="padding:72px 0 40px; background:#ffffff; color:#0f172a;">
          <div class="sp-container" style="max-width:960px; margin:0 auto; padding:0 24px;">
            <header style="text-align:center; max-width:540px; margin:0 auto 36px;">
              <p style="margin:0; text-transform:uppercase; letter-spacing:0.12em; font-weight:600; color:#0e7490; font-size:13px;">FAQ</p>
              <h2 style="margin:14px 0 12px; font-size:clamp(28px,3.5vw,36px);">Najczęstsze pytania</h2>
              <p style="margin:0; color:rgba(15,23,42,0.65);">Krótkie odpowiedzi, które uspokoją Twoją parę i ekipę przed sesją.</p>
            </header>
            <details style="background:#ffffff; border:1px solid rgba(15,23,42,0.1); border-radius:16px; padding:18px 22px; margin-bottom:14px; box-shadow:0 16px 32px rgba(15,23,42,0.06);">
              <summary style="cursor:pointer; color:#0f172a; font-weight:600; font-size:18px;">Czy muszę się logować?</summary>
              <div style="opacity:.85; margin-top:12px; color:rgba(15,23,42,0.75);">Nie — otwierasz planer i od razu ustawiasz trasę, światło i zadania.</div>
            </details>
            <details style="background:#ffffff; border:1px solid rgba(15,23,42,0.1); border-radius:16px; padding:18px 22px; margin-bottom:14px; box-shadow:0 16px 32px rgba(15,23,42,0.06);">
              <summary style="cursor:pointer; color:#0f172a; font-weight:600; font-size:18px;">Czy działa na telefonie?</summary>
              <div style="opacity:.85; margin-top:12px; color:rgba(15,23,42,0.75);">Tak — interfejs projektowaliśmy pod mobilne planowanie w terenie.</div>
            </details>
            <details style="background:#ffffff; border:1px solid rgba(15,23,42,0.1); border-radius:16px; padding:18px 22px; margin-bottom:14px; box-shadow:0 16px 32px rgba(15,23,42,0.06);">
              <summary style="cursor:pointer; color:#0f172a; font-weight:600; font-size:18px;">Czy mogę udostępnić plan?</summary>
              <div style="opacity:.85; margin-top:12px; color:rgba(15,23,42,0.75);">Tak — skopiuj link, wyślij PDF lub zduplikuj plan dla kolejnej sesji.</div>
            </details>
            <details style="background:#ffffff; border:1px solid rgba(15,23,42,0.1); border-radius:16px; padding:18px 22px; box-shadow:0 16px 32px rgba(15,23,42,0.06);">
              <summary style="cursor:pointer; color:#0f172a; font-weight:600; font-size:18px;">Czy mogę powielić harmonogram?</summary>
              <div style="opacity:.85; margin-top:12px; color:rgba(15,23,42,0.75);">Jasne — duplikujesz plan jednym kliknięciem i dopasowujesz szczegóły w minutę.</div>
            </details>
          </div>
        </section>
        <?php
        return (string) ob_get_clean();
    }
}


/** === Shortcode === */
add_shortcode('sunplanner', function () {
    wp_enqueue_style('sunplanner-css');
    wp_enqueue_script('sunplanner-app');
    wp_enqueue_script('sunplanner-gmaps');
    ob_start();
    echo sunplanner_get_intro_block();
    ?>
    <div id="sunplanner-app" class="sunplanner-wrap" data-version="1.7.5"></div>
    <?php return ob_get_clean();
});


add_filter('template_include', function ($template) {
    if (get_query_var('sunplan')) {
        $share_template = Templates::locate('share.php');
        if ($share_template !== '') {
            return $share_template;
        }
    }

    if (sunplanner_is_landing_page()) {
        $landing_template = Templates::locate('landing.php');
        if ($landing_template !== '') {
            return $landing_template;
        }
    }

    return $template;
});

add_action('template_redirect', function () {
    if (get_query_var('sunplan')) {
        status_header(200);
        global $wp_query;
        if ($wp_query) {
            $wp_query->is_404 = false;
            $wp_query->is_home = false;
            $wp_query->is_singular = true;
            $wp_query->is_page = true;
        }
    }
});

add_filter('document_title_parts', function ($parts) {
    if (get_query_var('sunplan')) {
        $parts['title'] = __('Plan pleneru ślubnego – SunPlanner', 'sunplanner');
    } elseif (sunplanner_is_landing_page()) {
        $parts['title'] = __('SunPlanner – inteligentny planer plenerów ślubnych', 'sunplanner');
    }

    return $parts;
});

add_filter('body_class', function ($classes) {
    if (get_query_var('sunplan')) {
        $classes[] = 'sunplanner-share-page';
    }

    if (sunplanner_is_landing_page()) {
        $classes[] = 'sunplanner-landing-page';
    }

    return $classes;
});



/** === REST: create short link === */
add_action('rest_api_init', function () {
    register_rest_route('sunplanner/v1', '/share', [
        'methods' => 'POST',
        'permission_callback' => '__return_true',
        'args' => [
            'sp' => ['required' => true, 'type' => 'string'],
            'id' => ['required' => false, 'type' => 'string'],
        ],
        'callback' => function (WP_REST_Request $req) {
            $sp = $req->get_param('sp');
            if (!is_string($sp) || $sp === '') {
                return new WP_REST_Response(['error' => 'empty'], 400);
            }

            $requested_id = $req->get_param('id');
            if (is_string($requested_id)) {
                $requested_id = substr(sanitize_key($requested_id), 0, 12);
            } else {
                $requested_id = '';
            }

            $prepare_response = function (string $share_id) use ($sp) {
                $opt_key = 'sunplanner_share_' . $share_id;
                $updated = update_option($opt_key, $sp, 'no');
                if (!$updated && false === get_option($opt_key, false)) {
                    return false;
                }

                $base = home_url(trailingslashit('sp/' . rawurlencode($share_id)));
                $url = add_query_arg(['sunplan' => $share_id], $base);

                return [
                    'id' => $share_id,
                    'url' => $url,
                    'updated' => true,
                ];
            };

            if ($requested_id !== '') {
                $updated = $prepare_response($requested_id);
                if ($updated !== false) {
                    return $updated;
                }
            }

            $id = '';
            $tries = 0;
            while ($tries < 5 && $id === '') {
                $raw = substr(wp_hash($sp . microtime(true) . wp_rand()), 0, 12);
                $candidate = substr(sanitize_key($raw), 0, 8);
                if ($candidate === '') {
                    $tries++;
                    continue;
                }
                $opt_key = 'sunplanner_share_' . $candidate;
                if (false !== get_option($opt_key, false)) {
                    $tries++;
                    continue;
                }
                if (add_option($opt_key, $sp, '', 'no')) {
                    $id = $candidate;
                }
                $tries++;
            }

            if ($id === '') {
                return new WP_REST_Response(['error' => 'unavailable'], 500);
            }

            $base = home_url(trailingslashit('sp/' . rawurlencode($id)));
            $url = add_query_arg(['sunplan' => $id], $base);
            return ['id' => $id, 'url' => $url, 'created' => true];
        }
    ]);
});

add_action('rest_api_init', function () {
    register_rest_route('sunplanner/v1', '/contact', [
        'methods' => 'POST',
        'permission_callback' => '__return_true',
        'callback' => 'sunplanner_handle_contact_request',
    ]);
});

/**
 * Proxy the legacy REST callback to the modern controller implementation.
 *
 * The route was still pointing to this function name, but the underlying
 * implementation was refactored into a namespaced controller class. When the
 * callback function went missing the REST request triggered a fatal error,
 * which bubbled up to the front-end as a generic "Nie udało się wysłać
 * powiadomień" message. By forwarding the call we keep backward compatibility
 * and make sure notifications can be sent again.
 *
 * @param \WP_REST_Request $request
 * @return \WP_REST_Response
 */
function sunplanner_handle_contact_request(\WP_REST_Request $request)
{
    static $controller = null;

    if (!$controller instanceof Contact_Controller) {
        $controller = new Contact_Controller();
    }

    return $controller->handle_request($request);
}

function sunplanner_contact_clean_slot($slot)
{
    $clean = [
        'date' => '',
        'time' => '',
        'favorite' => false,
    ];

    if (!is_array($slot)) {
        return $clean;
    }

    $date = isset($slot['date']) ? substr((string) $slot['date'], 0, 10) : '';
    if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
        $clean['date'] = $date;
    }

    $time = isset($slot['time']) ? substr((string) $slot['time'], 0, 5) : '';
    if (preg_match('/^\d{2}:\d{2}$/', $time)) {
        $clean['time'] = $time;
    }

    $clean['favorite'] = !empty($slot['favorite']);

    return $clean;
}

if (!defined('SUNPLANNER_FILE')) {
    define('SUNPLANNER_FILE', __FILE__);
}

if (!defined('SUNPLANNER_PATH')) {
    define('SUNPLANNER_PATH', plugin_dir_path(__FILE__));
}

if (!defined('SUNPLANNER_URL')) {
    define('SUNPLANNER_URL', plugin_dir_url(__FILE__));
}

require_once SUNPLANNER_PATH . 'includes/class-sunplanner-plugin.php';

function sunplanner_filter_radar_template($template)
{
    if (!is_string($template)) {
        return '';
    }

    $template = trim($template);
    if ($template === '') {
        return '';
    }

    if (strpos($template, 'https://tilecache.rainviewer.com/') !== 0) {
        return '';
    }

    if (strpos($template, '{z}') === false || strpos($template, '{x}') === false || strpos($template, '{y}') === false) {
        return '';
    }

    return $template;
}

function sunplanner_build_radar_template($base, $path)
{
    if (empty($path)) {
        return '';
    }

    $raw = trim((string) $path);
    if ($raw === '') {
        return '';
    }

    if (preg_match('#^https?://#i', $raw)) {
        $candidate = $raw;
    } else {
        $host = rtrim((string) $base, '/') . '/';
        $clean_path = ltrim($raw, '/');
        $candidate = $host . $clean_path;
    }

    if (strpos($candidate, 'https://tilecache.rainviewer.com/') !== 0) {
        $candidate = 'https://tilecache.rainviewer.com/' . ltrim($candidate, '/');
    }

    if (strpos($candidate, '{z}') !== false && strpos($candidate, '{x}') !== false && strpos($candidate, '{y}') !== false) {
        return sunplanner_filter_radar_template($candidate);
    }

    $candidate = rtrim($candidate, '/');

    return sunplanner_filter_radar_template($candidate . '/256/{z}/{x}/{y}/2/1_1.png');
}

function sunplanner_resolve_radar_template()
{
    $cache_key = 'sunplanner_radar_template';
    $cached = get_transient($cache_key);
    if (is_string($cached) && $cached !== '') {
        $valid = sunplanner_filter_radar_template($cached);
        if ($valid !== '') {
            return $valid;
        }
    }

    $fallbacks = [
        'https://tilecache.rainviewer.com/v4/composite/latest/256/{z}/{x}/{y}/2/1_1.png',
        'https://tilecache.rainviewer.com/v3/radar/nowcast/latest/256/{z}/{x}/{y}/2/1_1.png',
        'https://tilecache.rainviewer.com/v3/radar/nowcast/latest/256/{z}/{x}/{y}/3/1_1.png',
        'https://tilecache.rainviewer.com/v2/radar/last/256/{z}/{x}/{y}/2/1_1.png',
    ];

    $response = wp_remote_get('https://api.rainviewer.com/public/weather-maps.json', [
        'timeout' => 8,
        'headers' => [
            'Accept' => 'application/json',
            'User-Agent' => 'SunPlanner/1.7.2',
        ],
    ]);

    if (!is_wp_error($response) && wp_remote_retrieve_response_code($response) === 200) {
        $body = wp_remote_retrieve_body($response);
        $data = json_decode($body, true);
        if (is_array($data) && isset($data['radar'])) {
            $nowcast = isset($data['radar']['nowcast']) && is_array($data['radar']['nowcast']) ? $data['radar']['nowcast'] : [];
            $past = isset($data['radar']['past']) && is_array($data['radar']['past']) ? $data['radar']['past'] : [];
            $frames = array_merge($nowcast, $past);
            $frames = array_reverse($frames);
            foreach ($frames as $frame) {
                if (!is_array($frame)) {
                    continue;
                }
                $host = isset($frame['host']) ? $frame['host'] : 'https://tilecache.rainviewer.com/';
                $path = isset($frame['path']) ? $frame['path'] : '';
                if ($path === '' && isset($frame['time'])) {
                    $path = 'v2/radar/' . $frame['time'];
                }
                $template = sunplanner_build_radar_template($host, $path);
                if ($template === '' && isset($frame['url'])) {
                    $template = sunplanner_build_radar_template('', $frame['url']);
                }
                if ($template !== '') {
                    set_transient($cache_key, $template, 10 * MINUTE_IN_SECONDS);
                    return $template;
                }
            }
        }
    }

    foreach ($fallbacks as $fallback) {
        $valid = sunplanner_filter_radar_template($fallback);
        if ($valid !== '') {
            return $valid;
        }
    }

    return '';
}

add_action('rest_api_init', function () {
    register_rest_route('sunplanner/v1', '/radar', [
        'methods' => WP_REST_Server::READABLE,
        'permission_callback' => '__return_true',
        'callback' => function () {
            $template = sunplanner_resolve_radar_template();
            if ($template === '') {
                return new WP_REST_Response(['error' => 'unavailable'], 503);
            }

            return [
                'template' => $template,
            ];
        },
    ]);
});

}

