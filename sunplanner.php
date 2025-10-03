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
. '&libraries=places&language=pl&region=PL&v=weekly&loading=async&callback=initSunPlannerMap';


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

function sunplanner_contact_prepare_slots($slots)
{
    $prepared = [];
    if (is_array($slots)) {
        foreach ($slots as $slot) {
            $clean = sunplanner_contact_clean_slot($slot);
            if ($clean['date'] === '' && $clean['time'] === '') {
                continue;
            }
            $prepared[] = $clean;
            if (count($prepared) >= 6) {
                break;
            }
        }
    }
    return $prepared;
}

function sunplanner_contact_extract_role_email($contact, $role)
{
    if (!is_array($contact)) {
        return '';
    }

    $key = $role . 'Email';
    if (isset($contact[$key])) {
        $email = sanitize_email($contact[$key]);
        if ($email !== '') {
            return $email;
        }
    }

    if (isset($contact['roles']) && is_array($contact['roles'])) {
        $roles = $contact['roles'];
        if (isset($roles[$role]) && is_array($roles[$role]) && isset($roles[$role]['email'])) {
            $email = sanitize_email($roles[$role]['email']);
            if ($email !== '') {
                return $email;
            }
        }
    }

    return '';
}

function sunplanner_contact_role_label($role)
{
    switch ($role) {
        case 'couple':
            return __('Młoda para', 'sunplanner');
        case 'photographer':
            return __('Fotograf', 'sunplanner');
        case 'videographer':
            return __('Filmowiec', 'sunplanner');
        default:
            return $role;
    }
}

function sunplanner_contact_event_label($event)
{
    switch ($event) {
        case 'slot:proposed':
            return __('Propozycja terminu', 'sunplanner');
        case 'slot:confirmed':
            return __('Potwierdzenie terminu', 'sunplanner');
        case 'slot:rejected':
            return __('Odrzucenie terminu', 'sunplanner');
        case 'slot:removed':
            return __('Usunięcie terminu', 'sunplanner');
        case 'plan:shared':
            return __('Udostępnienie planu', 'sunplanner');
        case 'contact:reply':
            return __('Odpowiedź do pary młodej', 'sunplanner');
        default:
            return '';
    }
}

function sunplanner_contact_slot_details_lines($slot)
{
    if (!is_array($slot)) {
        return [];
    }

    $lines = [];

    $date = isset($slot['date']) ? $slot['date'] : '';
    $date_label = sunplanner_contact_format_plan_date($date);

    $time = isset($slot['time']) ? substr((string) $slot['time'], 0, 5) : '';
    if (!preg_match('/^\d{2}:\d{2}$/', $time)) {
        $time = '';
    }

    if ($date_label || $time) {
        if ($date_label && $time) {
            $lines[] = sprintf(__('Termin: %s o %s', 'sunplanner'), $date_label, $time);
        } elseif ($date_label) {
            $lines[] = sprintf(__('Termin: %s', 'sunplanner'), $date_label);
        } else {
            $lines[] = sprintf(__('Termin: %s', 'sunplanner'), $time);
        }
    }

    if (!empty($slot['title'])) {
        $lines[] = sprintf(__('Tytuł: %s', 'sunplanner'), sanitize_text_field($slot['title']));
    }

    if (!empty($slot['location'])) {
        $lines[] = sprintf(__('Miejsce: %s', 'sunplanner'), sanitize_text_field($slot['location']));
    }

    if (!empty($slot['duration'])) {
        $duration = absint($slot['duration']);
        if ($duration > 0) {
            $lines[] = sprintf(
                __('Czas trwania: %s', 'sunplanner'),
                sprintf(_n('%d minuta', '%d minut', $duration, 'sunplanner'), $duration)
            );
        }
    }

    if (!empty($slot['status'])) {
        $status = sanitize_key($slot['status']);
        $status_label = '';
        switch ($status) {
            case 'proposed':
                $status_label = __('Proponowany', 'sunplanner');
                break;
            case 'confirmed':
                $status_label = __('Potwierdzony', 'sunplanner');
                break;
            case 'rejected':
                $status_label = __('Odrzucony', 'sunplanner');
                break;
        }
        if ($status_label) {
            $lines[] = sprintf(__('Status: %s', 'sunplanner'), $status_label);
        }
    }

    return array_values(array_filter(array_map('trim', $lines)));
}

function sunplanner_contact_format_slot_line($slot)
{
    $slot = is_array($slot) ? $slot : [];
    $date = isset($slot['date']) ? $slot['date'] : '';
    $time = isset($slot['time']) ? $slot['time'] : '';
    $favorite = !empty($slot['favorite']);

    $date_label = '—';
    if ($date && preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
        $timestamp = strtotime($date . ' 12:00:00');
        if ($timestamp) {
            $date_label = wp_date(get_option('date_format'), $timestamp);
        }
    }

    $time_label = '';
    if ($time && preg_match('/^\d{2}:\d{2}$/', $time)) {
        $time_label = $time;
    }

    $line = '- ' . $date_label;
    if ($time_label !== '') {
        $line .= ' ' . sprintf(__('o %s', 'sunplanner'), $time_label);
    }
    if ($favorite) {
        $line .= ' ' . __('(najlepszy termin)', 'sunplanner');
    }

    return $line;
}

function sunplanner_contact_format_plan_date($date)
{
    if (!is_string($date) || $date === '') {
        return '';
    }
    $date = substr($date, 0, 10);
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
        return '';
    }
    $timestamp = strtotime($date . ' 12:00:00');
    if (!$timestamp) {
        return '';
    }
    return wp_date(get_option('date_format'), $timestamp);
}

function sunplanner_handle_contact_request(WP_REST_Request $req)
{
    $params = $req->get_json_params();
    if (!is_array($params)) {
        return new WP_REST_Response(['error' => 'invalid'], 400);
    }

    $target = isset($params['target']) ? sanitize_key($params['target']) : '';
    if (!in_array($target, ['photographer', 'couple', 'videographer'], true)) {
        return new WP_REST_Response(['error' => 'invalid_target'], 400);
    }

    $state = isset($params['state']) && is_array($params['state']) ? $params['state'] : [];
    $contact = isset($state['contact']) && is_array($state['contact']) ? $state['contact'] : [];

    $couple_email = sunplanner_contact_extract_role_email($contact, 'couple');
    $phot_email = sunplanner_contact_extract_role_email($contact, 'photographer');
    $video_email = sunplanner_contact_extract_role_email($contact, 'videographer');

    $actor = isset($params['actor']) ? sanitize_key($params['actor']) : '';
    if (!in_array($actor, ['couple', 'photographer', 'videographer'], true)) {
        $actor = '';
    }

    $event = isset($params['event']) ? sanitize_text_field($params['event']) : '';
    $slot_payload = isset($params['slot']) && is_array($params['slot']) ? $params['slot'] : [];
    $slot_details = sunplanner_contact_slot_details_lines($slot_payload);

    $home = home_url();

    $link = isset($params['link']) ? esc_url_raw($params['link']) : '';
    if ($link !== '' && strpos($link, $home) !== 0) {
        $link = '';
    }

    $short_link = isset($params['shortLink']) ? esc_url_raw($params['shortLink']) : '';
    if ($short_link !== '' && strpos($short_link, $home) !== 0) {
        $short_link = '';
    }

    $preview_link = $short_link !== '' ? $short_link : $link;

    $points = isset($state['pts']) && is_array($state['pts']) ? $state['pts'] : [];
    $destination = '';
    if (!empty($points)) {
        $last_point = $points[count($points) - 1];
        if (is_array($last_point) && isset($last_point['label'])) {
            $destination = sanitize_text_field($last_point['label']);
        }
    }

    switch ($target) {
        case 'photographer':
            $recipient = $phot_email;
            break;
        case 'videographer':
            $recipient = $video_email;
            break;
        default:
            $recipient = $couple_email;
            break;
    }
    if ($recipient === '') {
        return new WP_REST_Response(['error' => 'missing_email'], 400);
    }

    $reply_to = '';
    if ($actor === 'couple') {
        $reply_to = $couple_email;
    } elseif ($actor === 'photographer') {
        $reply_to = $phot_email;
    } elseif ($actor === 'videographer') {
        $reply_to = $video_email;
    }
    if ($reply_to === '') {
        if ($target === 'photographer') {
            $reply_to = $couple_email ? $couple_email : $video_email;
        } elseif ($target === 'videographer') {
            $reply_to = $couple_email ? $couple_email : $phot_email;
        } else {
            $reply_to = $phot_email ? $phot_email : $video_email;
        }
    }
    $site_name = wp_specialchars_decode(get_bloginfo('name'), ENT_QUOTES);

    $actor_label = $actor ? sunplanner_contact_role_label($actor) : '';
    $event_label = sunplanner_contact_event_label($event);

    $subject_parts = [];
    if ($event_label !== '') {
        $subject_parts[] = $event_label;
    }
    if ($actor_label !== '') {
        $subject_parts[] = $actor_label;
    }
    if ($site_name) {
        $subject_parts[] = $site_name;
    }
    if (!$subject_parts) {
        $subject_parts[] = __('Aktualizacja planu', 'sunplanner');
    }
    $subject = sprintf(__('SunPlanner: %s', 'sunplanner'), implode(' – ', $subject_parts));

    $lines = [];
    $lines[] = __('Cześć!', 'sunplanner');
    $lines[] = __('Otrzymaliśmy aktualizację zapytania o sesję plenerową w SunPlannerze.', 'sunplanner');
    if ($site_name) {
        $lines[] = sprintf(__('Plan pochodzi ze strony: %s', 'sunplanner'), $site_name);
    }
    if ($actor_label !== '') {
        $lines[] = sprintf(__('Autor aktualizacji: %s', 'sunplanner'), $actor_label);
    }
    if ($event_label !== '') {
        $lines[] = sprintf(__('Typ zmiany: %s', 'sunplanner'), $event_label);
    }
    if ($destination !== '') {
        $lines[] = sprintf(__('Cel sesji: %s', 'sunplanner'), $destination);
    }
    if ($preview_link) {
        $lines[] = sprintf(__('Podgląd planu: %s', 'sunplanner'), $preview_link);
    }

    if (!empty($slot_details)) {
        $lines[] = '';
        $lines[] = __('Szczegóły terminu:', 'sunplanner');
        foreach ($slot_details as $line) {
            $lines[] = $line;
        }
    }

    $lines[] = '';
    $lines[] = __('Aktualne terminy znajdziesz w SunPlannerze.', 'sunplanner');
    $lines[] = '';
    $lines[] = __('Wiadomość wygenerowana automatycznie w SunPlanner.', 'sunplanner');

    $headers = ['Content-Type: text/plain; charset=UTF-8'];
    if ($reply_to && $reply_to !== $recipient) {
        $headers[] = 'Reply-To: ' . $reply_to;
    }

    $sent = wp_mail($recipient, $subject, implode("\n", $lines), $headers);
    if (!$sent) {
        return new WP_REST_Response(['error' => 'mail_failed'], 500);
    }

    return new WP_REST_Response([
        'ok' => true,
        'message' => __('Powiadomienie wysłane.', 'sunplanner'),
    ], 200);
}

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
