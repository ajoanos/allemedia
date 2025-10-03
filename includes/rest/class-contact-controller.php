<?php

namespace Allemedia\SunPlanner\Rest;

use WP_REST_Request;
use WP_REST_Response;

class Contact_Controller
{
    public function register_routes(): void
    {
        \register_rest_route('sunplanner/v1', '/contact', [
            'methods' => 'POST',
            'permission_callback' => '__return_true',
            'callback' => [$this, 'handle_request'],
        ]);
    }

    /**
     * @return WP_REST_Response
     */
    public function handle_request(WP_REST_Request $req)
    {
        $params = $req->get_json_params();
        if (!\is_array($params)) {
            return new WP_REST_Response(['error' => 'invalid'], 400);
        }

        $target = isset($params['target']) ? \sanitize_key($params['target']) : '';
        if (!\in_array($target, ['photographer', 'couple', 'videographer'], true)) {
            return new WP_REST_Response(['error' => 'invalid_target'], 400);
        }

        $state = isset($params['state']) && \is_array($params['state']) ? $params['state'] : [];
        $contact = isset($state['contact']) && \is_array($state['contact']) ? $state['contact'] : [];

        $couple_email = $this->extract_role_email($contact, 'couple');
        $phot_email = $this->extract_role_email($contact, 'photographer');
        $video_email = $this->extract_role_email($contact, 'videographer');

        $actor = isset($params['actor']) ? \sanitize_key($params['actor']) : '';
        if (!\in_array($actor, ['couple', 'photographer', 'videographer'], true)) {
            $actor = '';
        }

        $event = isset($params['event']) ? \sanitize_text_field($params['event']) : '';
        $slot_payload = isset($params['slot']) && \is_array($params['slot']) ? $params['slot'] : [];
        $slot_details = $this->slot_details_lines($slot_payload);

        $home = \home_url();

        $link = isset($params['link']) ? \esc_url_raw($params['link']) : '';
        if ($link !== '' && \strpos($link, $home) !== 0) {
            $link = '';
        }

        $short_link = isset($params['shortLink']) ? \esc_url_raw($params['shortLink']) : '';
        if ($short_link !== '' && \strpos($short_link, $home) !== 0) {
            $short_link = '';
        }

        $preview_link = $short_link !== '' ? $short_link : $link;

        $points = isset($state['pts']) && \is_array($state['pts']) ? $state['pts'] : [];
        $destination = '';
        if (!empty($points)) {
            $last_point = $points[count($points) - 1];
            if (\is_array($last_point) && isset($last_point['label'])) {
                $destination = \sanitize_text_field($last_point['label']);
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

        $site_name = \wp_specialchars_decode(\get_bloginfo('name'), ENT_QUOTES);

        $actor_label = $actor ? $this->role_label($actor) : '';
        $event_label = $this->event_label($event);

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
            $subject_parts[] = \__('Aktualizacja planu', 'sunplanner');
        }
        $subject = \sprintf(\__('SunPlanner: %s', 'sunplanner'), \implode(' – ', $subject_parts));

        $lines = [];
        $lines[] = \__('Cześć!', 'sunplanner');
        $lines[] = \__('Otrzymaliśmy aktualizację zapytania o sesję plenerową w SunPlannerze.', 'sunplanner');
        if ($site_name) {
            $lines[] = \sprintf(\__('Plan pochodzi ze strony: %s', 'sunplanner'), $site_name);
        }
        if ($actor_label !== '') {
            $lines[] = \sprintf(\__('Autor aktualizacji: %s', 'sunplanner'), $actor_label);
        }
        if ($event_label !== '') {
            $lines[] = \sprintf(\__('Typ zmiany: %s', 'sunplanner'), $event_label);
        }
        if ($destination !== '') {
            $lines[] = \sprintf(\__('Cel sesji: %s', 'sunplanner'), $destination);
        }
        if ($preview_link) {
            $lines[] = \sprintf(\__('Podgląd planu: %s', 'sunplanner'), $preview_link);
        }

        if (!empty($slot_details)) {
            $lines[] = '';
            $lines[] = \__('Szczegóły terminu:', 'sunplanner');
            foreach ($slot_details as $line) {
                $lines[] = $line;
            }
        }

        $lines[] = '';
        $lines[] = \__('Aktualne terminy znajdziesz w SunPlannerze.', 'sunplanner');
        $lines[] = '';
        $lines[] = \__('Wiadomość wygenerowana automatycznie w SunPlanner.', 'sunplanner');

        $headers = ['Content-Type: text/plain; charset=UTF-8'];
        if ($reply_to && $reply_to !== $recipient) {
            $headers[] = 'Reply-To: ' . $reply_to;
        }

        $sent = \wp_mail($recipient, $subject, \implode("\n", $lines), $headers);
        if (!$sent) {
            return new WP_REST_Response(['error' => 'mail_failed'], 500);
        }

        return new WP_REST_Response([
            'ok' => true,
            'message' => \__('Powiadomienie wysłane.', 'sunplanner'),
        ], 200);
    }

    private function extract_role_email($contact, string $role): string
    {
        if (!\is_array($contact)) {
            return '';
        }

        $key = $role . 'Email';
        if (isset($contact[$key])) {
            $email = \sanitize_email($contact[$key]);
            if ($email !== '') {
                return $email;
            }
        }

        if (isset($contact['roles']) && \is_array($contact['roles'])) {
            $roles = $contact['roles'];
            if (isset($roles[$role]) && \is_array($roles[$role]) && isset($roles[$role]['email'])) {
                $email = \sanitize_email($roles[$role]['email']);
                if ($email !== '') {
                    return $email;
                }
            }
        }

        return '';
    }

    private function role_label(string $role): string
    {
        switch ($role) {
            case 'couple':
                return \__('Młoda para', 'sunplanner');
            case 'photographer':
                return \__('Fotograf', 'sunplanner');
            case 'videographer':
                return \__('Filmowiec', 'sunplanner');
            default:
                return $role;
        }
    }

    private function event_label(string $event): string
    {
        switch ($event) {
            case 'slot:proposed':
                return \__('Propozycja terminu', 'sunplanner');
            case 'slot:confirmed':
                return \__('Potwierdzenie terminu', 'sunplanner');
            case 'slot:rejected':
                return \__('Odrzucenie terminu', 'sunplanner');
            case 'slot:removed':
                return \__('Usunięcie terminu', 'sunplanner');
            case 'plan:shared':
                return \__('Udostępnienie planu', 'sunplanner');
            case 'contact:reply':
                return \__('Odpowiedź do pary młodej', 'sunplanner');
            default:
                return '';
        }
    }

    /**
     * @param array<string, mixed>|mixed $slot
     * @return array<int, string>
     */
    private function slot_details_lines($slot): array
    {
        if (!\is_array($slot)) {
            return [];
        }

        $lines = [];

        $date = isset($slot['date']) ? $slot['date'] : '';
        $date_label = $this->format_plan_date($date);

        $time = isset($slot['time']) ? \substr((string) $slot['time'], 0, 5) : '';
        if (!\preg_match('/^\d{2}:\d{2}$/', $time)) {
            $time = '';
        }

        if ($date_label || $time) {
            if ($date_label && $time) {
                $lines[] = \sprintf(\__('Termin: %s o %s', 'sunplanner'), $date_label, $time);
            } elseif ($date_label) {
                $lines[] = \sprintf(\__('Termin: %s', 'sunplanner'), $date_label);
            } else {
                $lines[] = \sprintf(\__('Termin: %s', 'sunplanner'), $time);
            }
        }

        if (!empty($slot['title'])) {
            $lines[] = \sprintf(\__('Tytuł: %s', 'sunplanner'), \sanitize_text_field($slot['title']));
        }

        if (!empty($slot['location'])) {
            $lines[] = \sprintf(\__('Miejsce: %s', 'sunplanner'), \sanitize_text_field($slot['location']));
        }

        if (!empty($slot['duration'])) {
            $duration = \absint($slot['duration']);
            if ($duration > 0) {
                $lines[] = \sprintf(
                    \__('Czas trwania: %s', 'sunplanner'),
                    \sprintf(\_n('%d minuta', '%d minut', $duration, 'sunplanner'), $duration)
                );
            }
        }

        if (!empty($slot['status'])) {
            $status = \sanitize_key($slot['status']);
            $status_label = '';
            switch ($status) {
                case 'proposed':
                    $status_label = \__('Proponowany', 'sunplanner');
                    break;
                case 'confirmed':
                    $status_label = \__('Potwierdzony', 'sunplanner');
                    break;
                case 'rejected':
                    $status_label = \__('Odrzucony', 'sunplanner');
                    break;
            }
            if ($status_label) {
                $lines[] = \sprintf(\__('Status: %s', 'sunplanner'), $status_label);
            }
        }

        return \array_values(\array_filter(\array_map('trim', $lines)));
    }

    private function format_plan_date($date): string
    {
        if (!\is_string($date) || $date === '') {
            return '';
        }
        $date = \substr($date, 0, 10);
        if (!\preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
            return '';
        }
        $timestamp = \strtotime($date . ' 12:00:00');
        if (!$timestamp) {
            return '';
        }
        return \wp_date(\get_option('date_format'), $timestamp);
    }
}
