<?php

namespace Allemedia\SunPlanner\Rest;

use WP_REST_Response;
use WP_REST_Server;

class Radar_Controller
{
    public function register_routes(): void
    {
        \register_rest_route('sunplanner/v1', '/radar', [
            'methods' => WP_REST_Server::READABLE,
            'permission_callback' => '__return_true',
            'callback' => [$this, 'handle_request'],
        ]);
    }

    /**
     * @return array<string, string>|WP_REST_Response
     */
    public function handle_request()
    {
        $template = $this->resolve_radar_template();
        if ($template === '') {
            return new WP_REST_Response(['error' => 'unavailable'], 503);
        }

        return ['template' => $template];
    }

    private function resolve_radar_template(): string
    {
        $cache_key = 'sunplanner_radar_template';
        $cached = \get_transient($cache_key);
        if (\is_string($cached) && $cached !== '') {
            $valid = $this->filter_radar_template($cached);
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

        $response = \wp_remote_get('https://api.rainviewer.com/public/weather-maps.json', [
            'timeout' => 8,
            'headers' => [
                'Accept' => 'application/json',
                'User-Agent' => 'SunPlanner/' . (defined('SUNPLANNER_VERSION') ? SUNPLANNER_VERSION : '1.0.0'),
            ],
        ]);

        if (!\is_wp_error($response) && \wp_remote_retrieve_response_code($response) === 200) {
            $body = \wp_remote_retrieve_body($response);
            $data = \json_decode($body, true);
            if (\is_array($data) && isset($data['radar'])) {
                $nowcast = isset($data['radar']['nowcast']) && \is_array($data['radar']['nowcast']) ? $data['radar']['nowcast'] : [];
                $past = isset($data['radar']['past']) && \is_array($data['radar']['past']) ? $data['radar']['past'] : [];
                $frames = \array_merge($nowcast, $past);
                $frames = \array_reverse($frames);
                foreach ($frames as $frame) {
                    if (!\is_array($frame)) {
                        continue;
                    }
                    $host = isset($frame['host']) ? $frame['host'] : 'https://tilecache.rainviewer.com/';
                    $path = isset($frame['path']) ? $frame['path'] : '';
                    if ($path === '' && isset($frame['time'])) {
                        $path = 'v2/radar/' . $frame['time'];
                    }
                    $template = $this->build_radar_template($host, $path);
                    if ($template === '' && isset($frame['url'])) {
                        $template = $this->build_radar_template('', $frame['url']);
                    }
                    if ($template !== '') {
                        \set_transient($cache_key, $template, 10 * MINUTE_IN_SECONDS);
                        return $template;
                    }
                }
            }
        }

        foreach ($fallbacks as $fallback) {
            $valid = $this->filter_radar_template($fallback);
            if ($valid !== '') {
                return $valid;
            }
        }

        return '';
    }

    private function filter_radar_template($template): string
    {
        if (!\is_string($template)) {
            return '';
        }

        $template = \trim($template);
        if ($template === '') {
            return '';
        }

        if (\strpos($template, 'https://tilecache.rainviewer.com/') !== 0) {
            return '';
        }

        if (\strpos($template, '{z}') === false || \strpos($template, '{x}') === false || \strpos($template, '{y}') === false) {
            return '';
        }

        return $template;
    }

    private function build_radar_template($base, $path): string
    {
        if (empty($path)) {
            return '';
        }

        $raw = \trim((string) $path);
        if ($raw === '') {
            return '';
        }

        if (\preg_match('#^https?://#i', $raw)) {
            $candidate = $raw;
        } else {
            $host = \rtrim((string) $base, '/') . '/';
            $clean_path = \ltrim($raw, '/');
            $candidate = $host . $clean_path;
        }

        if (\strpos($candidate, 'https://tilecache.rainviewer.com/') !== 0) {
            $candidate = 'https://tilecache.rainviewer.com/' . \ltrim($candidate, '/');
        }

        if (\strpos($candidate, '{z}') !== false && \strpos($candidate, '{x}') !== false && \strpos($candidate, '{y}') !== false) {
            return $this->filter_radar_template($candidate);
        }

        $candidate = \rtrim($candidate, '/');

        return $this->filter_radar_template($candidate . '/256/{z}/{x}/{y}/2/1_1.png');
    }
}
