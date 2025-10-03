<?php

namespace Allemedia\SunPlanner;

class Frontend
{
    public function register_hooks(): void
    {
        \add_action('wp_enqueue_scripts', [$this, 'register_assets']);
        \add_filter('script_loader_tag', [$this, 'ensure_script_charset'], 10, 3);
        \add_filter('style_loader_tag', [$this, 'ensure_style_charset'], 10, 4);
        \add_shortcode('sunplanner', [$this, 'render_shortcode']);
    }

    public function register_assets(): void
    {
        $version = defined('SUNPLANNER_VERSION') ? SUNPLANNER_VERSION : '1.0.0';

        \wp_register_style('sunplanner-css', \plugins_url('sunplanner.css', SUNPLANNER_FILE), [], $version);
        \wp_register_script('sunplanner-app', \plugins_url('sunplanner.js', SUNPLANNER_FILE), [], $version, true);

        $stub = 'window.initSunPlannerMap = function(){ window.dispatchEvent(new Event("sunplanner:gmaps-ready")); };';
        \wp_add_inline_script('sunplanner-app', $stub, 'before');

        $key = 'AIzaSyDP0vhFiZV_yDB8urPJtQ4UdKQpAzmuOcU';
        $gmaps_src = 'https://maps.googleapis.com/maps/api/js?key='
            . \rawurlencode($key)
            . '&libraries=places&language=pl&region=PL&v=weekly&loading=async&callback=initSunPlannerMap';

        \wp_register_script('sunplanner-gmaps', $gmaps_src, [], null, true);
        if (\function_exists('wp_script_add_data')) {
            \wp_script_add_data('sunplanner-gmaps', 'async', true);
            \wp_script_add_data('sunplanner-gmaps', 'defer', true);
        }

        $spid = \get_query_var('sunplan');
        $shared_sp = '';
        if ($spid) {
            $opt_key = 'sunplanner_share_' . \sanitize_key($spid);
            $val = \get_option($opt_key, '');
            if (\is_string($val) && $val !== '') {
                $shared_sp = $val;
            }
        }

        \wp_localize_script('sunplanner-app', 'SUNPLANNER_CFG', [
            'GMAPS_KEY' => $key,
            'CSE_ID' => 'b1d6737102d8e4107',
            'UNSPLASH_KEY' => 'OpKQ3jt1C2MKJW3v2U8jkhH0gWwBWj2w5BhoTxfa0tY',
            'TZ' => \wp_timezone_string(),
            'SHARED_SP' => $shared_sp,
            'SHARE_ID' => $spid,
            'SHARE_URL' => $spid ? \esc_url_raw(\home_url(\trailingslashit('sp/' . \rawurlencode($spid)))) : '',
            'REST_URL' => \esc_url_raw(\rest_url('sunplanner/v1/share')),
            'CONTACT_URL' => \esc_url_raw(\rest_url('sunplanner/v1/contact')),
            'SITE_ORIGIN' => \esc_url_raw(\home_url('/')),
            'RADAR_URL' => \esc_url_raw(\rest_url('sunplanner/v1/radar')),
        ]);
    }

    /**
     * @param string $tag
     * @param string $handle
     * @param string $src
     */
    public function ensure_script_charset(string $tag, string $handle, string $src): string
    {
        if ($handle === 'sunplanner-app' && \strpos($tag, ' charset=') === false) {
            return \str_replace('<script ', '<script charset="utf-8" ', $tag);
        }

        return $tag;
    }

    /**
     * @param string $html
     * @param string $handle
     * @param string $href
     * @param string $media
     */
    public function ensure_style_charset(string $html, string $handle, string $href, string $media): string
    {
        if ($handle === 'sunplanner-css' && \strpos($html, ' charset=') === false) {
            return \str_replace('<link ', '<link charset="utf-8" ', $html);
        }

        return $html;
    }

    public function render_shortcode(): string
    {
        \wp_enqueue_style('sunplanner-css');
        \wp_enqueue_script('sunplanner-app');
        \wp_enqueue_script('sunplanner-gmaps');

        \ob_start();
        ?>
        <div id="sunplanner-app" class="sunplanner-wrap" data-version="<?php echo \esc_attr(defined('SUNPLANNER_VERSION') ? SUNPLANNER_VERSION : ''); ?>"></div>
        <?php
        return (string) \ob_get_clean();
    }
}
