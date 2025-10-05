<?php

namespace Allemedia\SunPlanner;

class Rewrites
{
    public function register_hooks(): void
    {
        \add_action('init', [$this, 'register_rewrites']);
        \add_filter('query_vars', [$this, 'register_query_var']);
        \add_action('after_setup_theme', [$this, 'register_image_sizes']);
        \add_filter('template_include', [$this, 'maybe_use_share_template']);
        \add_action('template_redirect', [$this, 'adjust_share_query']);
        \add_filter('document_title_parts', [$this, 'filter_document_title']);
        \add_filter('body_class', [$this, 'filter_body_class']);
    }

    public static function flush_rewrite_rules(): void
    {
        \flush_rewrite_rules();
    }

    public function register_rewrites(): void
    {
        \add_rewrite_tag('%sunplan%', '([A-Za-z0-9_-]+)');
        \add_rewrite_rule('^sp/([A-Za-z0-9_-]+)/?$', 'index.php?sunplan=$matches[1]', 'top');
    }

    /**
     * @param array<int, string> $vars
     * @return array<int, string>
     */
    public function register_query_var(array $vars): array
    {
        $vars[] = 'sunplan';

        return $vars;
    }

    public function register_image_sizes(): void
    {
        \add_image_size('insp-xxl', 2200, 0, false);
        \add_image_size('insp-xl', 1600, 0, false);
        \add_image_size('insp-lg', 1200, 0, false);
        \add_image_size('insp-md', 900, 0, false);
        \add_image_size('insp-sm', 600, 0, false);
    }

    public function maybe_use_share_template(string $template): string
    {
        if (\get_query_var('sunplan')) {
            $share_template = \trailingslashit(SUNPLANNER_PATH) . 'sunplanner-share.php';
            if (\file_exists($share_template)) {
                return $share_template;
            }
        }

        return $template;
    }

    public function adjust_share_query(): void
    {
        if (!\get_query_var('sunplan')) {
            return;
        }

        \status_header(200);
        global $wp_query;
        if ($wp_query) {
            $wp_query->is_404 = false;
            $wp_query->is_home = false;
            $wp_query->is_singular = true;
            $wp_query->is_page = true;
        }
    }

    /**
     * @param array<string, string> $parts
     * @return array<string, string>
     */
    public function filter_document_title(array $parts): array
    {
        if (\get_query_var('sunplan')) {
            $parts['title'] = \__('Plan pleneru ślubnego – SunPlanner', 'sunplanner');
        }

        return $parts;
    }

    /**
     * @param array<int, string> $classes
     * @return array<int, string>
     */
    public function filter_body_class(array $classes): array
    {
        if (\get_query_var('sunplan')) {
            $classes[] = 'sunplanner-share-page';
        }

        return $classes;
    }
}
