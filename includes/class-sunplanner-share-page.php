<?php

class Sunplanner_Share_Page {
    /**
     * @var string
     */
    private $plugin_dir;

    public function __construct(string $plugin_dir)
    {
        $this->plugin_dir = rtrim($plugin_dir, '/\\') . '/';
    }

    public function register_hooks(): void
    {
        add_filter('template_include', [$this, 'filter_template']);
        add_action('template_redirect', [$this, 'handle_template_redirect']);
        add_filter('document_title_parts', [$this, 'filter_document_title_parts']);
        add_filter('body_class', [$this, 'filter_body_class']);
    }

    public function filter_template(string $template): string
    {
        if (!$this->is_share_request()) {
            return $template;
        }

        $share_template = $this->plugin_dir . 'sunplanner-share.php';
        if (file_exists($share_template)) {
            return $share_template;
        }

        return $template;
    }

    public function handle_template_redirect(): void
    {
        if (!$this->is_share_request()) {
            return;
        }

        status_header(200);

        global $wp_query;
        if ($wp_query) {
            $wp_query->is_404 = false;
            $wp_query->is_home = false;
            $wp_query->is_singular = true;
            $wp_query->is_page = true;
        }
    }

    public function filter_document_title_parts(array $parts): array
    {
        if ($this->is_share_request()) {
            $parts['title'] = __('Udostępniony plan – SunPlanner', 'sunplanner');
        }

        return $parts;
    }

    public function filter_body_class(array $classes): array
    {
        if ($this->is_share_request()) {
            $classes[] = 'sunplanner-share-page';
        }

        return $classes;
    }

    private function is_share_request(): bool
    {
        return (bool) get_query_var('sunplan');
    }
}
