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
        <section id="sunplanner-intro" class="relative container mx-auto px-6 md:px-8 py-16 md:py-24 max-w-[1200px] bg-gradient-to-br from-white via-white to-neutral-50">
          <div class="grid md:grid-cols-2 gap-10 items-center">
            <div>
              <div class="inline-flex items-center gap-2 rounded-full border border-black/10 px-3 py-1 text-sm text-black/70">
                ⏱ ok. 5 min
              </div>
              <h1 class="mt-4 text-4xl md:text-6xl font-semibold tracking-tight">
                SunPlanner — gotowy plan pleneru w 5 minut
              </h1>
              <p class="mt-4 text-lg md:text-xl text-black/70 max-w-prose">
                Wybierz miejsce na mapie, ustaw datę i od razu zobacz idealne godziny światła z prognozą godzinową.
                Udostępnij parze i ekipie jeden link z pełnym planem trasy i ujęć.
              </p>

              <div class="mt-8 flex flex-wrap gap-3">
                <a href="#sunplanner-app" class="inline-flex items-center rounded-full px-5 py-3 text-base font-medium bg-[var(--accent)] text-white hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40 transition">Otwórz planer</a>
                <a href="#sunplanner-steps" class="inline-flex items-center rounded-full px-5 py-3 text-base font-medium border border-[var(--accent)] text-[var(--accent)] hover:bg-[var(--accent)]/5 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20 transition">Zobacz, jak to działa</a>
              </div>

              <div class="mt-12 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div class="rounded-2xl border border-black/5 bg-white/70 backdrop-blur-sm p-6 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="h-6 w-6 mb-3 opacity-80">
                    <circle cx="12" cy="12" r="4"></circle>
                    <path d="M12 3v2m0 14v2m9-9h-2M5 12H3m15.364-6.364-1.414 1.414M8.05 15.95l-1.414 1.414m0-11.314L8.05 8.05m9.9 9.9-1.414-1.414"></path>
                  </svg>
                  <h3 class="text-lg font-medium">Światło</h3>
                  <p class="mt-1 text-black/70">Złota i niebieska godzina dla wybranej lokalizacji i daty.</p>
                </div>
                <div class="rounded-2xl border border-black/5 bg-white/70 backdrop-blur-sm p-6 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="h-6 w-6 mb-3 opacity-80">
                    <path d="M7 15a4 4 0 0 1 0-8 5 5 0 0 1 9.62-1.5A4 4 0 1 1 17 15H7Z"></path>
                  </svg>
                  <h3 class="text-lg font-medium">Pogoda godzinowa</h3>
                  <p class="mt-1 text-black/70">Temperatura, chmury, wiatr, opady, widoczność.</p>
                </div>
                <div class="rounded-2xl border border-black/5 bg-white/70 backdrop-blur-sm p-6 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="h-6 w-6 mb-3 opacity-80">
                    <path d="M12 21s7-5.686 7-11a7 7 0 1 0-14 0c0 5.314 7 11 7 11Z"></path>
                    <circle cx="12" cy="10" r="2.5"></circle>
                  </svg>
                  <h3 class="text-lg font-medium">Mapa ujęć</h3>
                  <p class="mt-1 text-black/70">Punkty zdjęć, współrzędne i czasy przejazdu w jednym widoku.</p>
                </div>
                <div class="rounded-2xl border border-black/5 bg-white/70 backdrop-blur-sm p-6 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="h-6 w-6 mb-3 opacity-80">
                    <path d="M10 13a5 5 0 0 1 7.071 0l2.122 2.121a3 3 0 1 1-4.243 4.243l-1.061-1.06"></path>
                    <path d="M14 11a5 5 0 0 1-7.071 0L4.808 8.879a3 3 0 1 1 4.243-4.243l1.06 1.061"></path>
                  </svg>
                  <h3 class="text-lg font-medium">Udostępnianie</h3>
                  <p class="mt-1 text-black/70">Wyślij gotowy plan jednym linkiem.</p>
                </div>
              </div>
            </div>

            <div>
              <div class="relative rounded-2xl border border-black/5 bg-white shadow-lg ring-1 ring-[var(--accent)]/10 overflow-hidden">
                <div class="bg-neutral-900 text-white px-5 py-4 flex items-center gap-2 text-sm font-medium">
                  <span class="inline-flex h-3 w-3 rounded-full bg-emerald-400"></span>
                  SunPlanner
                  <span class="ml-auto text-white/70">Podgląd planu</span>
                </div>
                <div class="grid gap-6 p-6 bg-white">
                  <div class="rounded-xl border border-black/5 bg-neutral-50 p-5">
                    <div class="flex items-center justify-between text-sm font-medium text-neutral-600">
                      <span>Godziny światła</span>
                      <span class="rounded-full bg-amber-100 px-3 py-1 text-amber-700 text-xs font-semibold">Złota godzina</span>
                    </div>
                    <div class="mt-4 h-2 rounded-full bg-gradient-to-r from-amber-300 via-yellow-200 to-blue-200"></div>
                    <p class="mt-3 text-sm text-neutral-600">Idealne okno zdjęć: 18:20 – 19:45</p>
                  </div>
                  <div class="rounded-xl border border-black/5 bg-white p-5">
                    <div class="flex items-center justify-between text-sm font-medium text-neutral-700">
                      <span>Prognoza godzinowa</span>
                      <span class="text-emerald-500 font-semibold">Stabilnie</span>
                    </div>
                    <div class="mt-4 grid grid-cols-4 gap-3 text-center text-xs text-neutral-500">
                      <div class="space-y-2">
                        <div class="font-semibold text-neutral-700">16:00</div>
                        <div class="rounded-lg bg-slate-50 py-2">
                          <div class="text-lg font-semibold text-neutral-800">20°C</div>
                          <div class="text-[11px] text-neutral-500">10% chmur</div>
                        </div>
                      </div>
                      <div class="space-y-2">
                        <div class="font-semibold text-neutral-700">17:00</div>
                        <div class="rounded-lg bg-slate-50 py-2">
                          <div class="text-lg font-semibold text-neutral-800">20°C</div>
                          <div class="text-[11px] text-neutral-500">12% chmur</div>
                        </div>
                      </div>
                      <div class="space-y-2">
                        <div class="font-semibold text-neutral-700">18:00</div>
                        <div class="rounded-lg bg-slate-50 py-2">
                          <div class="text-lg font-semibold text-neutral-800">19°C</div>
                          <div class="text-[11px] text-neutral-500">18% chmur</div>
                        </div>
                      </div>
                      <div class="space-y-2">
                        <div class="font-semibold text-neutral-700">19:00</div>
                        <div class="rounded-lg bg-slate-50 py-2">
                          <div class="text-lg font-semibold text-neutral-800">18°C</div>
                          <div class="text-[11px] text-neutral-500">22% chmur</div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div class="rounded-xl border border-black/5 bg-neutral-50 p-5">
                    <div class="flex items-center justify-between text-sm font-medium text-neutral-700">
                      <span>Mapa ujęć</span>
                      <span class="text-xs text-neutral-500">3 lokalizacje</span>
                    </div>
                    <div class="mt-4 space-y-3">
                      <div class="flex items-center gap-3 text-sm">
                        <span class="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--accent)]/10 text-[var(--accent)] font-semibold">1</span>
                        <div>
                          <div class="font-medium text-neutral-800">Park Królewski</div>
                          <div class="text-xs text-neutral-500">17:20 · portret w zieleni</div>
                        </div>
                      </div>
                      <div class="flex items-center gap-3 text-sm">
                        <span class="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--accent)]/10 text-[var(--accent)] font-semibold">2</span>
                        <div>
                          <div class="font-medium text-neutral-800">Most Widokowy</div>
                          <div class="text-xs text-neutral-500">18:10 · panorama miasta</div>
                        </div>
                      </div>
                      <div class="flex items-center gap-3 text-sm">
                        <span class="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--accent)]/10 text-[var(--accent)] font-semibold">3</span>
                        <div>
                          <div class="font-medium text-neutral-800">Plaża Miejska</div>
                          <div class="text-xs text-neutral-500">19:00 · zachód słońca</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="sunplanner-steps" class="container mx-auto px-6 md:px-8 py-12 md:py-16 max-w-[1100px]">
          <ol class="grid md:grid-cols-3 gap-6">
            <li class="rounded-2xl border border-black/5 bg-white p-6 shadow-sm">
              <h3 class="font-medium">1. Wybierz miejsce i datę</h3>
              <p class="mt-1 text-black/70">Zaznacz punkty zdjęć na mapie.</p>
            </li>
            <li class="rounded-2xl border border-black/5 bg-white p-6 shadow-sm">
              <h3 class="font-medium">2. Sprawdź światło i warunki</h3>
              <p class="mt-1 text-black/70">Złota/niebieska godzina i prognoza godzinowa.</p>
            </li>
            <li class="rounded-2xl border border-black/5 bg-white p-6 shadow-sm">
              <h3 class="font-medium">3. Wyślij plan</h3>
              <p class="mt-1 text-black/70">Jeden link dla pary i ekipy (bez logowania).</p>
            </li>
          </ol>
        </section>

        <div id="sunplanner-sticky" class="fixed top-0 inset-x-0 z-30 -translate-y-full transition">
          <div class="mx-auto max-w-[1200px] px-6 md:px-8">
            <div class="mt-2 mb-2 rounded-full border border-black/10 bg-white/80 backdrop-blur px-4 py-2 text-sm text-black/80 flex items-center gap-4">
              <span>📅 <span id="sp-date-label">Ustaw datę</span></span>
              <span>📍 <span id="sp-loc-label">Wybierz miejsce</span></span>
              <a href="#sunplanner-app" class="ml-auto underline">Przejdź do planera</a>
            </div>
          </div>
        </div>

        <script>
        // Pokazuj pasek po minięciu #sunplanner-intro
        (function(){
          const bar = document.getElementById('sunplanner-sticky');
          const intro = document.getElementById('sunplanner-intro');
          const dateLabel = document.getElementById('sp-date-label');
          const locLabel = document.getElementById('sp-loc-label');
          if (!bar || !intro) {
            return;
          }

          const toDisplayString = function(value) {
            if (typeof value === 'string') {
              return value.trim();
            }
            if (value && typeof value === 'object') {
              if (typeof value.label === 'string' && value.label.trim() !== '') {
                return value.label.trim();
              }
              if (typeof value.formatted === 'string' && value.formatted.trim() !== '') {
                return value.formatted.trim();
              }
              if (typeof value.text === 'string' && value.text.trim() !== '') {
                return value.text.trim();
              }
            }
            return '';
          };

          const applyState = function(state) {
            if (!state || typeof state !== 'object') {
              return;
            }

            if (dateLabel) {
              const label = toDisplayString(state.date) || (state.calendar && toDisplayString(state.calendar));
              if (label) {
                dateLabel.textContent = label;
              }
            }

            if (locLabel) {
              let locationLabel = toDisplayString(state.location);
              if (!locationLabel && Array.isArray(state.locations)) {
                locationLabel = toDisplayString(state.locations[0]);
              }
              if (!locationLabel && Array.isArray(state.points)) {
                locationLabel = toDisplayString(state.points[0]);
              }
              if (!locationLabel && Array.isArray(state.pts)) {
                const firstPoint = state.pts[0];
                locationLabel = toDisplayString(firstPoint && (firstPoint.label || firstPoint.name || firstPoint));
              }
              if (locationLabel) {
                locLabel.textContent = locationLabel;
              }
            }
          };

          const decodeShareParam = function(encoded) {
            if (typeof encoded !== 'string' || encoded.trim() === '') {
              return null;
            }
            const normalized = encoded.replace(/-/g, '+').replace(/_/g, '/');
            try {
              const json = atob(normalized);
              return JSON.parse(json);
            } catch (err) {
              return null;
            }
          };

          const fromQueryString = function() {
            try {
              const params = new URLSearchParams(window.location.search || '');
              const shareParam = params.get('sp');
              if (!shareParam) {
                return;
              }
              const decoded = decodeShareParam(shareParam);
              if (!decoded || typeof decoded !== 'object') {
                return;
              }
              const state = {
                date: decoded.date,
                pts: decoded.pts,
              };
              if (decoded.location) {
                state.location = decoded.location;
              }
              applyState(state);
            } catch (error) {
              // Fail silently – pasek pozostaje z tekstem domyślnym.
            }
          };

          window.addEventListener('sunplanner:state', function(event) {
            applyState(event.detail || {});
          });
          window.addEventListener('sunplanner:update', function(event) {
            applyState(event.detail || {});
          });

          fromQueryString();

          const observer = new IntersectionObserver(function(entries){
            const entry = entries[0];
            if (entry && entry.isIntersecting) {
              bar.classList.add('-translate-y-full');
              bar.classList.remove('translate-y-0');
            } else {
              bar.classList.remove('-translate-y-full');
              bar.classList.add('translate-y-0');
            }
          }, {threshold: 0});
          observer.observe(intro);
        })();
        </script>
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

