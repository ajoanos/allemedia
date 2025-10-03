<?php
/*
Plugin Name: SunPlanner
Plugin URI: https://allemedia.pl/
Description: Planer plenerów (złota/niebieska godzina, trasy, pogoda, eksporty).
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

register_activation_hook(SUNPLANNER_FILE, function () { flush_rewrite_rules(); });
register_deactivation_hook(SUNPLANNER_FILE, function () { flush_rewrite_rules(); });



add_filter('query_vars', function ($vars) { $vars[] = 'sunplan'; return $vars; });


/** === Assets === */

add_action('wp_enqueue_scripts', function () {
$ver = '1.7.5';

wp_register_style('sunplanner-css', plugins_url('assets/css/sunplanner.css', SUNPLANNER_FILE), [], $ver);
wp_register_script('sunplanner-app', plugins_url('assets/js/sunplanner.js', SUNPLANNER_FILE), [], $ver, true);



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
'TZ' => wp_timezone_string(),
'SHARED_SP' => $shared_sp,
'SHARE_ID' => $spid,
'SHARE_URL' => $spid ? esc_url_raw(home_url(trailingslashit('sp/' . rawurlencode($spid)))) : '',
'REST_URL' => esc_url_raw( rest_url('sunplanner/v1/share') ),
'CONTACT_URL' => esc_url_raw( rest_url('sunplanner/v1/contact') ),
'SITE_ORIGIN' => esc_url_raw( home_url('/') ),
'RADAR_URL' => esc_url_raw( rest_url('sunplanner/v1/radar') ),
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
if ($handle === 'sunplanner-css' && strpos($html, ' charset=') === false) {
$html = str_replace('<link ', '<link charset="utf-8" ', $html);
}
return $html;
}, 10, 4);


/** === Shortcode === */
add_shortcode('sunplanner', function () {
wp_enqueue_style('sunplanner-css');
wp_enqueue_script('sunplanner-app');
    wp_enqueue_script('sunplanner-gmaps');
    ob_start(); ?>
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
        $parts['title'] = __('Udostępniony plan – SunPlanner', 'sunplanner');
    }
    return $parts;
});

add_filter('body_class', function ($classes) {
    if (get_query_var('sunplan')) {
        $classes[] = 'sunplanner-share-page';
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

