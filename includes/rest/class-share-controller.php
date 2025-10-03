<?php

namespace Allemedia\SunPlanner\Rest;

use WP_REST_Request;
use WP_REST_Response;

class Share_Controller
{
    public function register_routes(): void
    {
        \register_rest_route('sunplanner/v1', '/share', [
            'methods' => 'POST',
            'permission_callback' => '__return_true',
            'args' => [
                'sp' => ['required' => true, 'type' => 'string'],
                'id' => ['required' => false, 'type' => 'string'],
            ],
            'callback' => [$this, 'handle_request'],
        ]);
    }

    /**
     * @return array<string, mixed>|WP_REST_Response
     */
    public function handle_request(WP_REST_Request $req)
    {
        $sp = $req->get_param('sp');
        if (!\is_string($sp) || $sp === '') {
            return new WP_REST_Response(['error' => 'empty'], 400);
        }

        $requested_id = $req->get_param('id');
        if (\is_string($requested_id)) {
            $requested_id = \substr(\sanitize_key($requested_id), 0, 12);
        } else {
            $requested_id = '';
        }

        $prepare_response = function (string $share_id) use ($sp) {
            $opt_key = 'sunplanner_share_' . $share_id;
            $updated = \update_option($opt_key, $sp, 'no');
            if (!$updated && false === \get_option($opt_key, false)) {
                return false;
            }

            $base = \home_url(\trailingslashit('sp/' . \rawurlencode($share_id)));
            $url = \add_query_arg(['sunplan' => $share_id], $base);

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
            $raw = \substr(\wp_hash($sp . \microtime(true) . \wp_rand()), 0, 12);
            $candidate = \substr(\sanitize_key($raw), 0, 8);
            if ($candidate === '') {
                $tries++;
                continue;
            }
            $opt_key = 'sunplanner_share_' . $candidate;
            if (false !== \get_option($opt_key, false)) {
                $tries++;
                continue;
            }
            if (\add_option($opt_key, $sp, '', 'no')) {
                $id = $candidate;
            }
            $tries++;
        }

        if ($id === '') {
            return new WP_REST_Response(['error' => 'unavailable'], 500);
        }

        $base = \home_url(\trailingslashit('sp/' . \rawurlencode($id)));
        $url = \add_query_arg(['sunplan' => $id], $base);

        return ['id' => $id, 'url' => $url, 'created' => true];
    }
}
