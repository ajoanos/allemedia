<?php
add_action('init', function () {
add_rewrite_tag('%sunplan%', '([A-Za-z0-9_-]+)');
add_rewrite_rule('^sp/([A-Za-z0-9_-]+)/?$', 'index.php?sunplan=$matches[1]', 'top');
});
register_activation_hook(__FILE__, function () { flush_rewrite_rules(); });
register_deactivation_hook(__FILE__, function () { flush_rewrite_rules(); });


add_filter('query_vars', function ($vars) { $vars[] = 'sunplan'; return $vars; });


/** === Assets === */
add_action('wp_enqueue_scripts', function () {
$ver = '1.7.1';
wp_register_style('sunplanner-css', plugins_url('sunplanner.css', __FILE__), [], $ver);
wp_register_script('sunplanner-app', plugins_url('sunplanner.js', __FILE__), [], $ver, true);


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
'REST_URL' => esc_url_raw( rest_url('sunplanner/v1/share') ),
'SITE_ORIGIN' => esc_url_raw( home_url('/') ),
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
<div id="sunplanner-app" class="sunplanner-wrap" data-version="1.7.1"></div>
<?php return ob_get_clean();
});

add_filter('template_include', function ($template) {
    if (get_query_var('sunplan')) {
        $share_template = plugin_dir_path(__FILE__) . 'sunplanner-share.php';
        if (file_exists($share_template)) {
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
        }
    }
});


/** === REST: create short link === */
add_action('rest_api_init', function () {
register_rest_route('sunplanner/v1', '/share', [
'methods' => 'POST',
'permission_callback' => '__return_true',
'args' => [
'sp' => ['required' => true, 'type' => 'string'],
],
'callback' => function (WP_REST_Request $req) {
$sp = $req->get_param('sp');
if (!is_string($sp) || $sp === '') {
return new WP_REST_Response(['error' => 'empty'], 400);
}
$id = substr(wp_hash($sp . microtime(true)), 0, 8);
$opt_key = 'sunplanner_share_' . $id;
add_option($opt_key, $sp, '', 'no');
$url = home_url('/sp/' . rawurlencode($id) . '/');
return ['id' => $id, 'url' => $url];
}
]);
});
